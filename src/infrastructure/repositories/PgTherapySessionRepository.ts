import pool from '../database/connection';
import { TherapySession, TherapySessionProps, TherapySessionSummary } from '../../domain/entities/TherapySession';
import { TherapyType } from '../../domain/entities/Therapist';
import {
  TherapySessionRepository,
  TherapySessionCreateInput,
  TherapySessionFilters,
  TherapySessionUpdateInput,
} from '../../domain/repositories/TherapySessionRepository';

export class PgTherapySessionRepository implements TherapySessionRepository {
  private mapRowToSession(row: Record<string, unknown>): TherapySession {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      therapistId: row.therapist_id as string | null,
      therapyType: row.therapy_type as TherapyType,
      occurredAt: new Date(row.occurred_at as string),
      durationMinutes: row.duration_minutes as number | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies TherapySessionProps;
    return new TherapySession(props);
  }

  private mapRowToSummary(row: Record<string, unknown>): TherapySessionSummary {
    return {
      id: row.id as string,
      childId: row.child_id as string,
      therapistId: row.therapist_id as string | null,
      therapyType: row.therapy_type as TherapyType,
      occurredAt: new Date(row.occurred_at as string),
      durationMinutes: row.duration_minutes as number | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  async save(input: TherapySessionCreateInput): Promise<TherapySession> {
    const result = await pool.query(
      `INSERT INTO therapy_sessions
         (id, user_id, child_id, therapist_id, therapy_type, occurred_at, duration_minutes, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.therapistId ?? null,
        input.therapyType,
        input.occurredAt,
        input.durationMinutes ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToSession(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<TherapySession | null> {
    const result = await pool.query(
      `SELECT * FROM therapy_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToSession(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: TherapySessionFilters,
  ): Promise<{ data: TherapySessionSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.therapyType) {
      params.push(filters.therapyType);
      conditions.push(`therapy_type = $${params.length}`);
    }
    if (filters.therapistId) {
      params.push(filters.therapistId);
      conditions.push(`therapist_id = $${params.length}`);
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
      `SELECT COUNT(*) FROM therapy_sessions WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, child_id, therapist_id, therapy_type, occurred_at, duration_minutes, notes, created_at
       FROM therapy_sessions
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
    input: TherapySessionUpdateInput,
  ): Promise<TherapySession | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if ('therapistId' in input) {
      params.push(input.therapistId ?? null);
      setClauses.push(`therapist_id = $${params.length}`);
    }
    if (input.therapyType !== undefined) {
      params.push(input.therapyType);
      setClauses.push(`therapy_type = $${params.length}`);
    }
    if (input.occurredAt !== undefined) {
      params.push(input.occurredAt);
      setClauses.push(`occurred_at = $${params.length}`);
    }
    if ('durationMinutes' in input) {
      params.push(input.durationMinutes ?? null);
      setClauses.push(`duration_minutes = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE therapy_sessions
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToSession(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM therapy_sessions WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
