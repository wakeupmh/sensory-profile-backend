import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';
import { PoolClient } from 'pg';

export interface CaregiverData {
  name: string;
  relationship: string;
  contact?: string;
}

export class CaregiverService {
  async createCaregiver(caregiverData: CaregiverData, userId: string, externalClient?: PoolClient): Promise<string | null> {
    if (!caregiverData) return null;

    const queryable = externalClient ?? pool;
    const caregiverId = uuidv7();
    const result = await queryable.query(
      `INSERT INTO caregivers (id, name, relationship, contact, user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name, relationship, user_id) DO UPDATE SET
         contact = COALESCE(EXCLUDED.contact, caregivers.contact),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [caregiverId, caregiverData.name, caregiverData.relationship, caregiverData.contact || null, userId]
    );

    return result.rows[0].id;
  }

}
