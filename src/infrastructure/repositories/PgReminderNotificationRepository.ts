import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { ReminderChannel, ReminderNotificationRepository } from '../../domain/repositories/ReminderNotificationRepository';

export class PgReminderNotificationRepository implements ReminderNotificationRepository {
  async reserve(userId: string, reminderKey: string, channel: ReminderChannel): Promise<boolean> {
    const result = await pool.query(
      `INSERT INTO reminder_notifications (id, user_id, reminder_key, channel)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, reminder_key, channel) DO NOTHING`,
      [uuidv7(), userId, reminderKey, channel],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async reserveMany(userId: string, reminderKeys: string[], channel: ReminderChannel): Promise<string[]> {
    if (reminderKeys.length === 0) return [];
    const result = await pool.query<{ reminder_key: string }>(
      `INSERT INTO reminder_notifications (id, user_id, reminder_key, channel)
       SELECT unnest($1::uuid[]), $2, unnest($3::text[]), $4
       ON CONFLICT (user_id, reminder_key, channel) DO NOTHING
       RETURNING reminder_key`,
      [reminderKeys.map(() => uuidv7()), userId, reminderKeys, channel],
    );
    return result.rows.map((r) => r.reminder_key);
  }

  async releaseMany(userId: string, reminderKeys: string[], channel: ReminderChannel): Promise<void> {
    if (reminderKeys.length === 0) return;
    await pool.query(
      `DELETE FROM reminder_notifications
        WHERE user_id = $1 AND channel = $2 AND reminder_key = ANY($3::text[])`,
      [userId, channel, reminderKeys],
    );
  }

  async release(userId: string, reminderKey: string, channel: ReminderChannel): Promise<void> {
    await pool.query(
      `DELETE FROM reminder_notifications WHERE user_id = $1 AND reminder_key = $2 AND channel = $3`,
      [userId, reminderKey, channel],
    );
  }
}
