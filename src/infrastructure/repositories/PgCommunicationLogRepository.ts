import pool from '../database/connection';
import {
  CommunicationLog,
  CommunicationLogProps,
  CommunicationEntryType,
} from '../../domain/entities/CommunicationLog';
import {
  CommunicationLogRepository,
  CommunicationLogCreateInput,
  CommunicationLogUpdateInput,
  CommunicationLogFilters,
  CommunicationLogSummary,
} from '../../domain/repositories/CommunicationLogRepository';

export class PgCommunicationLogRepository implements CommunicationLogRepository {
  private mapRowToLog(row: Record<string, unknown>): CommunicationLog {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      occurredAt: new Date(row.occurred_at as string),
      entryType: row.entry_type as CommunicationEntryType,
      description: row.description as string | null,
      wordsCount: row.words_count as number | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies CommunicationLogProps;
    return new CommunicationLog(props);
  }

  private mapRowToSummary(row: Record<string, unknown>): CommunicationLogSummary {
    return {
      id: row.id as string,
      childId: row.child_id as string,
      occurredAt: new Date(row.occurred_at as string),
      entryType: row.entry_type as CommunicationEntryType,
      description: row.description as string | null,
      wordsCount: row.words_count as number | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  async save(input: CommunicationLogCreateInput): Promise<CommunicationLog> {
    const result = await pool.query(
      `INSERT INTO communication_logs
         (id, user_id, child_id, occurred_at, entry_type, description, words_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.occurredAt,
        input.entryType,
        input.description ?? null,
        input.wordsCount ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToLog(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<CommunicationLog | null> {
    const result = await pool.query(
      `SELECT * FROM communication_logs WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToLog(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: CommunicationLogFilters,
  ): Promise<{ data: CommunicationLogSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.entryType) {
      params.push(filters.entryType);
      conditions.push(`entry_type = $${params.length}`);
    }
    if (filters.from) {
      params.push(filters.from);
      conditions.push(`occurred_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      conditions.push(`occurred_at <= $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM communication_logs WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, child_id, occurred_at, entry_type, description, words_count, created_at
       FROM communication_logs
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows.map((row) => this.mapRowToSummary(row)),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(
    id: string,
    userId: string,
    input: CommunicationLogUpdateInput,
  ): Promise<CommunicationLog | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.occurredAt !== undefined) {
      params.push(input.occurredAt);
      setClauses.push(`occurred_at = $${params.length}`);
    }
    if (input.entryType !== undefined) {
      params.push(input.entryType);
      setClauses.push(`entry_type = $${params.length}`);
    }
    if ('description' in input) {
      params.push(input.description ?? null);
      setClauses.push(`description = $${params.length}`);
    }
    if ('wordsCount' in input) {
      params.push(input.wordsCount ?? null);
      setClauses.push(`words_count = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE communication_logs
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToLog(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM communication_logs WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
