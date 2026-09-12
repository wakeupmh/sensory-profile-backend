import pool from '../database/connection';
import { GoalProgressEntry, GoalProgressEntryProps } from '../../domain/entities/GoalProgressEntry';
import { GoalStatus } from '../../domain/entities/Goal';
import {
  GoalProgressEntryRepository,
  GoalProgressEntryCreateInput,
} from '../../domain/repositories/GoalProgressEntryRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'goal_progress_entries',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    goalId: col.immutable('goal_id', read.text),
    recordedAt: col.immutable('recorded_at', read.timestamp),
    value: col.immutable('value', read.numberOrNull),
    statusSnapshot: col.immutable('status_snapshot', read.rawOrNull<GoalStatus>()),
    notes: col.immutable('notes', read.textOrNull),
    therapySessionId: col.immutable('therapy_session_id', read.textOrNull),
    createdAt: col.createdAt(),
  } satisfies ColumnsFor<GoalProgressEntryProps>,
  // Toda coluna é imutável: o lançamento de progresso é um FATO datado — não
  // se edita, se acrescenta outro. Por isso o repositório não tem `update`.
});

export class PgGoalProgressEntryRepository implements GoalProgressEntryRepository {
  private toEntity(row: Record<string, unknown>): GoalProgressEntry {
    return new GoalProgressEntry(TABLE.mapRow(row));
  }

  async save(input: GoalProgressEntryCreateInput): Promise<GoalProgressEntry> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<GoalProgressEntry | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByGoal(goalId: string, userId: string): Promise<GoalProgressEntry[]> {
    const result = await pool.query(
      `SELECT * FROM goal_progress_entries WHERE goal_id = $1 AND user_id = $2 ORDER BY recorded_at DESC`,
      [goalId, userId],
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { sql, params } = TABLE.deleteById(id, userId);
    const result = await pool.query(sql, params);
    return (result.rowCount ?? 0) > 0;
  }
}
