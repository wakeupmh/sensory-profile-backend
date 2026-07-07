import pool from '../database/connection';
import { LogAttachment, LogAttachmentProps } from '../../domain/entities/LogAttachment';
import {
  LogAttachmentRepository,
  LogAttachmentCreateInput,
} from '../../domain/repositories/LogAttachmentRepository';

export class PgLogAttachmentRepository implements LogAttachmentRepository {
  private mapRow(row: Record<string, unknown>): LogAttachment {
    const props = {
      id: row.id as string,
      logId: row.log_id as string,
      storageKey: row.storage_key as string,
      mimeType: row.mime_type as string,
      sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
      createdAt: new Date(row.created_at as string),
    } satisfies LogAttachmentProps;
    return new LogAttachment(props);
  }

  async save(input: LogAttachmentCreateInput): Promise<LogAttachment> {
    const result = await pool.query(
      `INSERT INTO log_attachments (id, log_id, storage_key, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.id, input.logId, input.storageKey, input.mimeType, input.sizeBytes ?? null],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<LogAttachment | null> {
    const result = await pool.query(`SELECT * FROM log_attachments WHERE id = $1`, [id]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findByLogId(logId: string): Promise<LogAttachment[]> {
    const result = await pool.query(
      `SELECT * FROM log_attachments WHERE log_id = $1 ORDER BY created_at ASC`,
      [logId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByLogIds(logIds: string[]): Promise<LogAttachment[]> {
    if (logIds.length === 0) return [];
    const result = await pool.query(
      `SELECT * FROM log_attachments WHERE log_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
      [logIds],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM log_attachments WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
