import pool from '../database/connection';
import { UserProfile, UserProfileProps } from '../../domain/entities/UserProfile';
import { UserProfileRepository } from '../../domain/repositories/UserProfileRepository';

export class PgUserProfileRepository implements UserProfileRepository {
  private mapRow(row: Record<string, unknown>): UserProfile {
    const props = {
      userId: row.user_id as string,
      email: (row.email as string | null) ?? null,
      reminderEmailsEnabled: row.reminder_emails_enabled as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies UserProfileProps;
    return new UserProfile(props);
  }

  async upsertEmail(userId: string, email: string | null): Promise<void> {
    if (!email) return;
    await pool.query(
      `INSERT INTO user_profiles (user_id, email)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET email = EXCLUDED.email, updated_at = CURRENT_TIMESTAMP
         WHERE user_profiles.email IS DISTINCT FROM EXCLUDED.email`,
      [userId, email],
    );
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const result = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async setReminderEmailsEnabled(userId: string, enabled: boolean): Promise<UserProfile> {
    const result = await pool.query(
      `INSERT INTO user_profiles (user_id, reminder_emails_enabled)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET reminder_emails_enabled = EXCLUDED.reminder_emails_enabled, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, enabled],
    );
    return this.mapRow(result.rows[0]);
  }

  async findAllEligibleForReminders(): Promise<UserProfile[]> {
    const result = await pool.query(
      `SELECT * FROM user_profiles WHERE email IS NOT NULL AND reminder_emails_enabled = true`,
    );
    return result.rows.map((row) => this.mapRow(row));
  }
}
