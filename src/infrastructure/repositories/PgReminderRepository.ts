import pool from '../database/connection';
import { Reminder, ReminderProps, ReminderStatus } from '../../domain/entities/Reminder';
import {
  ReminderRepository,
  ReminderCreateInput,
  ReminderUpdateInput,
  ReminderFilters,
} from '../../domain/repositories/ReminderRepository';
import { buildWhere, FilterSpec } from './queryUtils';

const FILTER_MAP: Record<string, FilterSpec> = {
  childId: ['child_id'],
  status: ['status'],
};

export class PgReminderRepository implements ReminderRepository {
  private mapRow(row: Record<string, unknown>): Reminder {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      title: row.title as string,
      dueAt: new Date(row.due_at as string),
      status: row.status as ReminderStatus,
      resourceType: (row.resource_type as string | null) ?? null,
      resourceId: (row.resource_id as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies ReminderProps;
    return new Reminder(props);
  }

  async save(input: ReminderCreateInput): Promise<Reminder> {
    const result = await pool.query(
      `INSERT INTO reminders
         (id, user_id, child_id, title, due_at, status, resource_type, resource_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.title,
        input.dueAt,
        input.status ?? 'pending',
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Reminder | null> {
    const result = await pool.query(
      `SELECT * FROM reminders WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: ReminderFilters): Promise<Reminder[]> {
    const { where, params } = buildWhere(userId, filters as unknown as Record<string, unknown>, FILTER_MAP);
    const result = await pool.query(
      `SELECT * FROM reminders WHERE ${where} ORDER BY due_at ASC`,
      params,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(id: string, userId: string, input: ReminderUpdateInput): Promise<Reminder | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.title !== undefined) {
      params.push(input.title);
      setClauses.push(`title = $${params.length}`);
    }
    if (input.dueAt !== undefined) {
      params.push(input.dueAt);
      setClauses.push(`due_at = $${params.length}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE reminders
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM reminders WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
