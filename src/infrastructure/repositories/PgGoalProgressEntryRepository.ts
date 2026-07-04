import pool from '../database/connection';
import { GoalProgressEntry, GoalProgressEntryProps } from '../../domain/entities/GoalProgressEntry';
import { GoalStatus } from '../../domain/entities/Goal';
import {
  GoalProgressEntryRepository,
  GoalProgressEntryCreateInput,
} from '../../domain/repositories/GoalProgressEntryRepository';

export class PgGoalProgressEntryRepository implements GoalProgressEntryRepository {
  private mapRow(row: Record<string, unknown>): GoalProgressEntry {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      goalId: row.goal_id as string,
      recordedAt: new Date(row.recorded_at as string),
      value: row.value == null ? null : Number(row.value),
      statusSnapshot: (row.status_snapshot as GoalStatus | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      therapySessionId: (row.therapy_session_id as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
    } satisfies GoalProgressEntryProps;
    return new GoalProgressEntry(props);
  }

  async save(input: GoalProgressEntryCreateInput): Promise<GoalProgressEntry> {
    const result = await pool.query(
      `INSERT INTO goal_progress_entries
         (id, user_id, goal_id, recorded_at, value, status_snapshot, notes, therapy_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.goalId,
        input.recordedAt,
        input.value ?? null,
        input.statusSnapshot ?? null,
        input.notes ?? null,
        input.therapySessionId ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<GoalProgressEntry | null> {
    const result = await pool.query(
      `SELECT * FROM goal_progress_entries WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByGoal(goalId: string, userId: string): Promise<GoalProgressEntry[]> {
    const result = await pool.query(
      `SELECT * FROM goal_progress_entries WHERE goal_id = $1 AND user_id = $2 ORDER BY recorded_at DESC`,
      [goalId, userId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM goal_progress_entries WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
