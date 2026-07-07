import pool from '../database/connection';
import { Document, DocumentProps } from '../../domain/entities/Document';
import {
  DocumentRepository,
  DocumentCreateInput,
  DocumentUpdateInput,
  DocumentFilters,
} from '../../domain/repositories/DocumentRepository';
import { buildWhere, FilterSpec } from './queryUtils';

const FILTER_MAP: Record<string, FilterSpec> = {
  childId: ['child_id'],
  resourceType: ['resource_type'],
  resourceId: ['resource_id'],
};

export class PgDocumentRepository implements DocumentRepository {
  private mapRow(row: Record<string, unknown>): Document {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      storageKey: row.storage_key as string,
      mimeType: row.mime_type as string,
      sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
      resourceType: (row.resource_type as string | null) ?? null,
      resourceId: (row.resource_id as string | null) ?? null,
      expiresAt: row.expires_at == null ? null : new Date(row.expires_at as string),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies DocumentProps;
    return new Document(props);
  }

  async save(input: DocumentCreateInput): Promise<Document> {
    const result = await pool.query(
      `INSERT INTO documents
         (id, user_id, child_id, title, description, storage_key, mime_type,
          size_bytes, resource_type, resource_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.title,
        input.description ?? null,
        input.storageKey,
        input.mimeType,
        input.sizeBytes ?? null,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.expiresAt ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Document | null> {
    const result = await pool.query(`SELECT * FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: DocumentFilters): Promise<Document[]> {
    const { where, params } = buildWhere(userId, filters as unknown as Record<string, unknown>, FILTER_MAP);
    const result = await pool.query(
      `SELECT * FROM documents WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(id: string, userId: string, input: DocumentUpdateInput): Promise<Document | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.title !== undefined) { params.push(input.title); setClauses.push(`title = $${params.length}`); }
    if ('description' in input) { params.push(input.description ?? null); setClauses.push(`description = $${params.length}`); }
    if ('expiresAt' in input) { params.push(input.expiresAt ?? null); setClauses.push(`expires_at = $${params.length}`); }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE documents
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
