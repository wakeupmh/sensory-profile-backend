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

  async getCaregiverById(caregiverId: string, userId: string): Promise<(CaregiverData & { id: string }) | null> {
    const result = await pool.query(
      'SELECT * FROM caregivers WHERE id = $1 AND user_id = $2',
      [caregiverId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const caregiver = result.rows[0];
    return {
      id: caregiver.id,
      name: caregiver.name,
      relationship: caregiver.relationship,
      contact: caregiver.contact
    };
  }

  async getAllCaregivers(userId: string): Promise<Array<CaregiverData & { id: string }>> {
    const result = await pool.query(
      `SELECT * FROM caregivers
       WHERE user_id = $1
       ORDER BY name`,
      [userId]
    );

    return result.rows.map(caregiver => ({
      id: caregiver.id,
      name: caregiver.name,
      relationship: caregiver.relationship,
      contact: caregiver.contact
    }));
  }
}
