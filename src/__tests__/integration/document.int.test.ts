/**
 * Integration tests for DocumentService.
 *
 * Tests exercise the service against mock repositories + a stub S3StorageService
 * and a fake pg Pool — no real database or S3 connection required.
 *
 * DocumentService tests:
 *  1.  requestUpload throws NotFoundError when child does not belong to user
 *  2.  requestUpload builds storageKey as documents/{userId}/{childId}/{id}
 *  3.  requestUpload returns the saved document and the presigned upload URL
 *  4.  requestUpload passes mimeType through to storage.getUploadUrl
 *  4a. requestUpload forwards expiresAt through to repo.save (present and omitted)
 *  5.  getDownloadUrl returns the URL from storage keyed off the document storageKey
 *  6.  getDownloadUrl throws when document not found
 *  7.  remove deletes the DB row before deleting the S3 object (ordering)
 *  8.  remove still deletes the S3 object even when the DB row exists
 *  9.  remove throws when document not found (no S3 call made)
 */

import { DocumentService } from 'application/services/DocumentService';
import { Document } from 'domain/entities/Document';
import type { DocumentRepository } from 'domain/repositories/DocumentRepository';
import type { S3StorageService } from 'infrastructure/storage/S3StorageService';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const DOC_ID = '018f4e8a-0000-7000-8000-000000000001';
const NOW = new Date('2024-06-15T10:30:00.000Z');
const UPLOAD_URL = 'https://s3.example.com/put-signed';
const DOWNLOAD_URL = 'https://s3.example.com/get-signed';

function makeDocument(overrides: Record<string, unknown> = {}): Document {
  return new Document({
    id: DOC_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    title: 'Laudo',
    description: null,
    storageKey: `documents/${USER_ID}/${CHILD_ID}/${DOC_ID}`,
    mimeType: 'application/pdf',
    sizeBytes: null,
    resourceType: null,
    resourceId: null,
    expiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeRepo(overrides: Partial<DocumentRepository> = {}): DocumentRepository {
  return {
    save: jest.fn().mockResolvedValue(makeDocument()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStorage(overrides: Partial<S3StorageService> = {}): S3StorageService {
  return {
    getUploadUrl: jest.fn().mockResolvedValue(UPLOAD_URL),
    getDownloadUrl: jest.fn().mockResolvedValue(DOWNLOAD_URL),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as S3StorageService;
}

// Minimal fake Pool — DocumentService only calls pool.query.
function makePool(childBelongsToUser = true) {
  return {
    query: jest.fn().mockResolvedValue({ rows: childBelongsToUser ? [{ 1: 1 }] : [] }),
  } as unknown as import('pg').Pool;
}

function makeService(opts: {
  repo?: Partial<DocumentRepository>;
  storage?: Partial<S3StorageService>;
  childBelongsToUser?: boolean;
} = {}): DocumentService {
  return new DocumentService(
    makeRepo(opts.repo),
    makeStorage(opts.storage),
    makePool(opts.childBelongsToUser ?? true),
  );
}

describe('DocumentService', () => {
  test('requestUpload throws NotFoundError when child belongs to another user', async () => {
    const service = makeService({ childBelongsToUser: false });
    await expect(
      service.requestUpload(
        { childId: CHILD_ID, title: 'Laudo', mimeType: 'application/pdf' },
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  test('requestUpload builds storageKey as documents/{userId}/{childId}/{id}', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    const payload = {
      childId: CHILD_ID,
      title: 'Laudo',
      mimeType: 'application/pdf',
      description: 'desc',
    };
    await service.requestUpload(payload, USER_ID);
    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.storageKey).toMatch(new RegExp(`^documents/${USER_ID}/${CHILD_ID}/[0-9a-f-]+$`));
  });

  test('requestUpload returns the saved document and the presigned upload URL', async () => {
    const doc = makeDocument();
    const repo = makeRepo({ save: jest.fn().mockResolvedValue(doc) });
    const service = makeService({ repo });
    const result = await service.requestUpload(
      { childId: CHILD_ID, title: 'Laudo', mimeType: 'application/pdf' },
      USER_ID,
    );
    expect(result.document).toBeInstanceOf(Document);
    expect(result.uploadUrl).toBe(UPLOAD_URL);
  });

  test('requestUpload forwards expiresAt through to repo.save', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    const expiresAt = new Date('2025-12-31T00:00:00.000Z');
    await service.requestUpload(
      { childId: CHILD_ID, title: 'Laudo', mimeType: 'application/pdf', expiresAt },
      USER_ID,
    );
    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.expiresAt).toBe(expiresAt);
  });

  test('requestUpload saves expiresAt as null when omitted', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    await service.requestUpload(
      { childId: CHILD_ID, title: 'Laudo', mimeType: 'application/pdf' },
      USER_ID,
    );
    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.expiresAt).toBeNull();
  });

  test('requestUpload forwards mimeType to storage.getUploadUrl', async () => {
    const storage = makeStorage();
    const service = makeService({ storage });
    await service.requestUpload(
      { childId: CHILD_ID, title: 'Laudo', mimeType: 'image/png' },
      USER_ID,
    );
    expect(storage.getUploadUrl).toHaveBeenCalledWith(expect.any(String), 'image/png');
  });

  test('getDownloadUrl returns the URL from storage keyed off the document storageKey', async () => {
    const doc = makeDocument();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(doc) });
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    const url = await service.getDownloadUrl(DOC_ID, USER_ID);
    expect(url).toBe(DOWNLOAD_URL);
    expect(storage.getDownloadUrl).toHaveBeenCalledWith(doc.getStorageKey());
  });

  test('getDownloadUrl throws when document not found', async () => {
    const service = makeService();
    await expect(service.getDownloadUrl(DOC_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  test('remove deletes the DB row before the S3 object (ordering)', async () => {
    const doc = makeDocument();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(doc),
      delete: jest.fn().mockResolvedValue(true),
    });
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    await service.remove(DOC_ID, USER_ID);
    const deleteCallOrder = (repo.delete as jest.Mock).mock.invocationCallOrder[0];
    const s3DeleteCallOrder = (storage.deleteObject as jest.Mock).mock.invocationCallOrder[0];
    expect(deleteCallOrder).toBeLessThan(s3DeleteCallOrder);
    expect(storage.deleteObject).toHaveBeenCalledWith(doc.getStorageKey());
  });

  test('remove calls storage.deleteObject exactly once for an existing document', async () => {
    const doc = makeDocument();
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(doc),
      delete: jest.fn().mockResolvedValue(true),
    });
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    await service.remove(DOC_ID, USER_ID);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  test('remove throws NotFoundError and does not call S3 when document missing', async () => {
    const storage = makeStorage();
    const service = makeService({ storage });
    await expect(service.remove(DOC_ID, USER_ID)).rejects.toThrow(NotFoundError);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  test('getById throws NotFoundError when repo returns null', async () => {
    const service = makeService();
    await expect(service.getById(DOC_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });
});