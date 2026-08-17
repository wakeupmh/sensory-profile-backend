import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { PushSubscription, PushSubscriptionProps } from '../../domain/entities/PushSubscription';
import { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';

export class PgPushSubscriptionRepository implements PushSubscriptionRepository {
  private mapRow(row: Record<string, unknown>): PushSubscription {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      endpoint: row.endpoint as string,
      p256dhKey: row.p256dh_key as string,
      authKey: row.auth_key as string,
      createdAt: new Date(row.created_at as string),
    } satisfies PushSubscriptionProps;
    return new PushSubscription(props);
  }

  async upsert(userId: string, endpoint: string, p256dhKey: string, authKey: string): Promise<PushSubscription> {
    const result = await pool.query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh_key = EXCLUDED.p256dh_key, auth_key = EXCLUDED.auth_key
       RETURNING *`,
      [uuidv7(), userId, endpoint, p256dhKey, authKey],
    );
    return this.mapRow(result.rows[0]);
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
  }

  async deleteById(id: string): Promise<void> {
    await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [id]);
  }

  async findAll(): Promise<PushSubscription[]> {
    const result = await pool.query(`SELECT * FROM push_subscriptions`);
    return result.rows.map((row) => this.mapRow(row));
  }
}
