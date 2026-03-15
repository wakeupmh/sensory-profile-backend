import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';

export interface CaregiverData {
  name: string;
  relationship: string;
  contact?: string;
}

export class CaregiverService {
  async createCaregiver(caregiverData: CaregiverData): Promise<string | null> {
    if (!caregiverData) return null;

    const caregiverId = uuidv7();
    const result = await pool.query(
      `INSERT INTO caregivers (id, name, relationship, contact)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name, relationship) DO UPDATE SET
         contact = COALESCE(EXCLUDED.contact, caregivers.contact),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [caregiverId, caregiverData.name, caregiverData.relationship, caregiverData.contact || null]
    );

    return result.rows[0].id;
  }
  
  async getCaregiverById(caregiverId: string): Promise<CaregiverData | null> {
    const result = await pool.query(
      'SELECT * FROM caregivers WHERE id = $1',
      [caregiverId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const caregiver = result.rows[0];
    return {
      name: caregiver.name,
      relationship: caregiver.relationship,
      contact: caregiver.contact
    };
  }
  
  async getAllCaregivers(userId: string): Promise<Array<CaregiverData & { id: string }>> {
    const result = await pool.query(
      `SELECT * FROM caregivers
       WHERE id IN (SELECT caregiver_id FROM sensory_assessments WHERE user_id = $1)
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
