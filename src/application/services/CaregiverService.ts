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
    
    // Check if a caregiver with the same name and relationship already exists
    const existingCaregiver = await pool.query(
      'SELECT id FROM caregivers WHERE name = $1 AND relationship = $2',
      [caregiverData.name, caregiverData.relationship]
    );
    
    if (existingCaregiver.rows.length > 0) {
      const caregiverId = existingCaregiver.rows[0].id;
      
      // Update the existing caregiver with new contact info if provided
      if (caregiverData.contact) {
        await pool.query(
          `UPDATE caregivers SET 
            contact = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
          [caregiverData.contact, caregiverId]
        );
      }
      
      return caregiverId;
    }
    
    // Create a new caregiver
    const caregiverId = uuidv7();
    await pool.query(
      `INSERT INTO caregivers (
        id, name, relationship, contact
      ) VALUES ($1, $2, $3, $4)`,
      [
        caregiverId,
        caregiverData.name,
        caregiverData.relationship,
        caregiverData.contact || null
      ]
    );
    
    return caregiverId;
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
  
  async getAllCaregivers(): Promise<Array<CaregiverData & { id: string }>> {
    const result = await pool.query(
      'SELECT * FROM caregivers ORDER BY name'
    );
    
    return result.rows.map(caregiver => ({
      id: caregiver.id,
      name: caregiver.name,
      relationship: caregiver.relationship,
      contact: caregiver.contact
    }));
  }
}
