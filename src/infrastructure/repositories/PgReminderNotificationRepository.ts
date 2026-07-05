import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { ReminderNotificationRepository } from '../../domain/repositories/ReminderNotificationRepository';

export class PgReminderNotificationRepository implements ReminderNotificationRepository {
  async reserve(userId: string, reminderKey: string): Promise<boolean> {
    const result = await pool.query(
      `INSERT INTO reminder_notifications (id, user_id, reminder_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, reminder_key) DO NOTHING`,
      [uuidv7(), userId, reminderKey],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async release(userId: string, reminderKey: string): Promise<void> {
    await pool.query(
      `DELETE FROM reminder_notifications WHERE user_id = $1 AND reminder_key = $2`,
      [userId, reminderKey],
    );
  }
}
