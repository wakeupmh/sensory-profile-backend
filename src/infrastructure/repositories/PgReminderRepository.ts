import pool from '../database/connection';
import { Reminder, ReminderProps, ReminderStatus } from '../../domain/entities/Reminder';
import {
  ReminderRepository,
  ReminderCreateInput,
  ReminderUpdateInput,
  ReminderFilters,
} from '../../domain/repositories/ReminderRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'reminders',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    title: col.required('title', read.text),
    dueAt: col.required('due_at', read.timestamp),
    status: col.required('status', read.raw<ReminderStatus>(), { insertDefault: 'pending' }),
    // O lembrete aponta para o registro que o originou e não muda de alvo:
    // `ReminderUpdateInput` não tem os dois campos.
    resourceType: col.immutable('resource_type', read.textOrNull),
    resourceId: col.immutable('resource_id', read.textOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<ReminderProps>,
  filters: { childId: ['child_id'], status: ['status'] },
});

export class PgReminderRepository implements ReminderRepository {
  private toEntity(row: Record<string, unknown>): Reminder {
    return new Reminder(TABLE.mapRow(row));
  }

  async save(input: ReminderCreateInput): Promise<Reminder> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Reminder | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: ReminderFilters): Promise<Reminder[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM reminders WHERE ${where} ORDER BY due_at ASC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: ReminderUpdateInput): Promise<Reminder | null> {
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
