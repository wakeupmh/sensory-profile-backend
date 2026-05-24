import pool from '../database/connection';
import { DailyLog, DailyLogProps, DailyLogSummary, LogData, LogType } from '../../domain/entities/DailyLog';
import {
  DailyLogRepository,
  DailyLogCreateInput,
  DailyLogUpdateInput,
  DailyLogFilters,
} from '../../domain/repositories/DailyLogRepository';

export class PgDailyLogRepository implements DailyLogRepository {
  async save(input: DailyLogCreateInput): Promise<DailyLog> {
    const result = await pool.query(
      `INSERT INTO daily_logs (id, user_id, child_id, log_type, occurred_at, data, notes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.logType,
        input.occurredAt,
        JSON.stringify(input.data),
        input.notes ?? null,
      ]
    );
    return this.mapRowToLog(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<DailyLog | null> {
    const result = await pool.query(
      `SELECT * FROM daily_logs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToLog(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: DailyLogFilters
  ): Promise<{ data: DailyLogSummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.logType) {
      params.push(filters.logType);
      conditions.push(`log_type = $${params.length}`);
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
      `SELECT COUNT(*) FROM daily_logs WHERE ${where}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, child_id, log_type, occurred_at, notes, created_at
       FROM daily_logs
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: dataResult.rows.map((row) => ({
        id: row.id as string,
        childId: row.child_id as string,
        logType: row.log_type as LogType,
        occurredAt: new Date(row.occurred_at as string),
        notes: (row.notes as string | null) ?? null,
        createdAt: new Date(row.created_at as string),
      })),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(
    id: string,
    userId: string,
    input: DailyLogUpdateInput
  ): Promise<DailyLog | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (input.logType !== undefined) {
      params.push(input.logType);
      setClauses.push(`log_type = $${params.length}`);
    }
    if (input.occurredAt !== undefined) {
      params.push(input.occurredAt);
      setClauses.push(`occurred_at = $${params.length}`);
    }
    if (input.data !== undefined) {
      params.push(JSON.stringify(input.data));
      setClauses.push(`data = $${params.length}::jsonb`);
    }
    // notes can be explicitly set to null to clear it
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE daily_logs
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToLog(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM daily_logs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToLog(row: Record<string, unknown>): DailyLog {
    return new DailyLog({
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      logType: row.log_type as LogType,
      occurredAt: new Date(row.occurred_at as string),
      data: row.data as LogData,
      notes: (row.notes as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies DailyLogProps);
  }
}
