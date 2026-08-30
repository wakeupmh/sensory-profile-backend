import pool from '../database/connection';
import { DailyLog, DailyLogProps, DailyLogSummary, LogData, LogType } from '../../domain/entities/DailyLog';
import {
  DailyLogRepository,
  DailyLogCreateInput,
  DailyLogUpdateInput,
  DailyLogFilters,
} from '../../domain/repositories/DailyLogRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'daily_logs',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    logType: col.required('log_type', read.raw<LogType>()),
    occurredAt: col.required('occurred_at', read.timestamp),
    data: col.required('data', read.raw<LogData>(), {
      write: (value) => JSON.stringify(value),
      cast: '::jsonb',
    }),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<DailyLogProps>,
  filters: {
    childId: ['child_id'],
    logType: ['log_type'],
    from: ['occurred_at', '>='],
    to: ['occurred_at', '<='],
  },
});

/** A projeção da listagem: as colunas do SELECT e a leitura da linha saem daqui. */
const SUMMARY = ['id', 'childId', 'logType', 'occurredAt', 'notes', 'createdAt'] as const;

export class PgDailyLogRepository implements DailyLogRepository {
  private toEntity(row: Record<string, unknown>): DailyLog {
    return new DailyLog(TABLE.mapRow(row));
  }

  async save(input: DailyLogCreateInput): Promise<DailyLog> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<DailyLog | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: DailyLogFilters
  ): Promise<{ data: DailyLogSummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(1000, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const { where, params } = TABLE.listWhere(userId, filters);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM daily_logs WHERE ${where}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ${TABLE.columnsOf(SUMMARY)}
       FROM daily_logs
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      data: dataResult.rows.map((row) => TABLE.pick(row, SUMMARY) satisfies DailyLogSummary),
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
