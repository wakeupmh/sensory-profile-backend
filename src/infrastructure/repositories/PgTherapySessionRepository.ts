import pool from '../database/connection';
import {
  TherapySession,
  TherapySessionProps,
  TherapySessionSummary,
} from '../../domain/entities/TherapySession';
import { TherapyType } from '../../domain/entities/Therapist';
import {
  TherapySessionRepository,
  TherapySessionCreateInput,
  TherapySessionFilters,
  TherapySessionUpdateInput,
} from '../../domain/repositories/TherapySessionRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'therapy_sessions',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    therapistId: col.nullable('therapist_id', read.textOrNull),
    therapyType: col.required('therapy_type', read.raw<TherapyType>()),
    occurredAt: col.required('occurred_at', read.timestamp),
    durationMinutes: col.nullable('duration_minutes', read.numberOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<TherapySessionProps>,
  // `therapy_sessions` é child-scoped, e esta listagem NÃO passava por
  // `buildWhere`: montava `user_id = $1` à mão, então a concessão do care team
  // não a alcançava.
  filters: {
    childId: ['child_id'],
    therapyType: ['therapy_type'],
    therapistId: ['therapist_id'],
    from: ['occurred_at', '>='],
    to: ['occurred_at', '<='],
  },
});

/** A projeção da listagem: as colunas do SELECT e a leitura da linha saem daqui. */
const SUMMARY = [
  'id',
  'childId',
  'therapistId',
  'therapyType',
  'occurredAt',
  'durationMinutes',
  'notes',
  'createdAt',
] as const;

export class PgTherapySessionRepository implements TherapySessionRepository {
  private toEntity(row: Record<string, unknown>): TherapySession {
    return new TherapySession(TABLE.mapRow(row));
  }

  async save(input: TherapySessionCreateInput): Promise<TherapySession> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<TherapySession | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: TherapySessionFilters,
  ): Promise<{ data: TherapySessionSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const { where, params } = TABLE.listWhere(userId, filters);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM therapy_sessions WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ${TABLE.columnsOf(SUMMARY)}
       FROM therapy_sessions
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows.map((row) => TABLE.pick(row, SUMMARY) satisfies TherapySessionSummary),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(
    id: string,
    userId: string,
    input: TherapySessionUpdateInput,
  ): Promise<TherapySession | null> {
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
