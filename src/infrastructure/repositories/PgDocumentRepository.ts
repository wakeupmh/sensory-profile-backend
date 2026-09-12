import pool from '../database/connection';
import { Document, DocumentProps } from '../../domain/entities/Document';
import {
  DocumentRepository,
  DocumentCreateInput,
  DocumentUpdateInput,
  DocumentFilters,
} from '../../domain/repositories/DocumentRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'documents',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    title: col.required('title', read.text),
    description: col.nullable('description', read.textOrNull),
    storageKey: col.immutable('storage_key', read.text),
    mimeType: col.immutable('mime_type', read.text),
    sizeBytes: col.immutable('size_bytes', read.numberOrNull),
    resourceType: col.immutable('resource_type', read.textOrNull),
    resourceId: col.immutable('resource_id', read.textOrNull),
    expiresAt: col.nullable('expires_at', read.timestampOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<DocumentProps>,
  filters: { childId: ['child_id'], resourceType: ['resource_type'], resourceId: ['resource_id'] },
});

export class PgDocumentRepository implements DocumentRepository {
  private toEntity(row: Record<string, unknown>): Document {
    return new Document(TABLE.mapRow(row));
  }

  async save(input: DocumentCreateInput): Promise<Document> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Document | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: DocumentFilters): Promise<Document[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM documents WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: DocumentUpdateInput): Promise<Document | null> {
    const statement = TABLE.update(id, userId, input);
    if (!statement) return this.findById(id, userId);
    const result = await pool.query(statement.sql, statement.params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { sql, params } = TABLE.deleteById(id, userId);
    const result = await pool.query(sql, params);
    return (result.rowCount ?? 0) > 0;
  }
}
