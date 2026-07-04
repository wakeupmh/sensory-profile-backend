import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { Document } from '../../domain/entities/Document';
import {
  DocumentRepository,
  DocumentCreateInput,
  DocumentUpdateInput,
  DocumentFilters,
} from '../../domain/repositories/DocumentRepository';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import { BaseDomainService } from './BaseDomainService';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface RequestUploadPayload {
  childId: string;
  title: string;
  description?: string | null;
  mimeType: string;
  sizeBytes?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

export interface RequestUploadResult {
  document: Document;
  uploadUrl: string;
}

export class DocumentService extends BaseDomainService<
  Document,
  DocumentCreateInput,
  DocumentUpdateInput,
  never,
  DocumentUpdateInput,
  DocumentFilters
> {
  constructor(
    repo: DocumentRepository,
    private readonly storage: S3StorageService,
    private readonly pool: Pool,
  ) {
    super(repo, 'Documento não encontrado');
  }

  private async assertChildOwnership(childId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, userId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
  }

  async requestUpload(payload: RequestUploadPayload, userId: string): Promise<RequestUploadResult> {
    await this.assertChildOwnership(payload.childId, userId);

    const id = uuidv7();
    // Storage key deliberately excludes user-supplied filename text — avoids
    // path-traversal/odd-character issues in S3 keys entirely.
    const storageKey = `documents/${userId}/${payload.childId}/${id}`;

    const uploadUrl = await this.storage.getUploadUrl(storageKey, payload.mimeType);

    // ponytail: orphan-row leak — the metadata row is created before the client
    // PUTs the file to S3. If the upload never completes, the row points at a
    // missing object and download-url returns a signed URL that 404s. Upgrade
    // path: add a nullable `uploaded_at` column + a POST /api/documents/:id/confirm
    // endpoint that runs an S3 HEAD to mark confirmed, and a sweep that deletes
    // rows where uploaded_at IS NULL AND created_at < now() - interval '1 hour'.
    const document = await this.repo.save({
      id,
      userId,
      childId: payload.childId,
      title: payload.title,
      description: payload.description ?? null,
      storageKey,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes ?? null,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
    });

    return { document, uploadUrl };
  }

  async getDownloadUrl(id: string, userId: string): Promise<string> {
    const document = await this.getById(id, userId);
    return this.storage.getDownloadUrl(document.getStorageKey());
  }

  async remove(id: string, userId: string): Promise<void> {
    const document = await this.getById(id, userId);
    // ponytail: DB-then-S3 ordering — delete the row first; if S3 fails the row
    // is already gone and a separate S3 sweep can reap the orphan object. The
    // previous order (S3 first → DB fails) left a row whose download-url pointed
    // at a deleted object — unrecoverable without manual SQL.
    await super.remove(id, userId);
    await this.storage.deleteObject(document.getStorageKey());
  }
}
