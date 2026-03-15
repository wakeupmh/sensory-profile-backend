import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';

export interface ChildData {
  name: string;
  birthDate: string;
  gender?: string;
  nationalIdentity?: string;
  otherInfo?: string;
}

export class ChildService {
  async findOrCreateChild(childData: ChildData, userId: string): Promise<string> {
    // If nationalIdentity is provided, use upsert to avoid race conditions
    if (childData.nationalIdentity) {
      const childId = uuidv7();
      const result = await pool.query(
        `INSERT INTO children (id, name, birth_date, gender, national_identity, user_id, other_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (national_identity, user_id) DO UPDATE SET
           name = EXCLUDED.name,
           birth_date = EXCLUDED.birth_date,
           gender = EXCLUDED.gender,
           other_info = EXCLUDED.other_info,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          childId,
          childData.name,
          childData.birthDate,
          childData.gender || null,
          childData.nationalIdentity,
          userId,
          childData.otherInfo || null
        ]
      );

      return result.rows[0].id;
    }

    // No nationalIdentity — always create a new child
    const childId = uuidv7();
    await pool.query(
      `INSERT INTO children (
        id, name, birth_date, gender, national_identity, user_id, other_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        childId,
        childData.name,
        childData.birthDate,
        childData.gender || null,
        null,
        userId,
        childData.otherInfo || null
      ]
    );

    return childId;
  }
  
  async getChildById(childId: string, userId: string): Promise<ChildData | null> {
    const result = await pool.query(
      'SELECT * FROM children WHERE id = $1 AND user_id = $2',
      [childId, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const child = result.rows[0];
    return {
      name: child.name,
      birthDate: child.birth_date.toISOString().split('T')[0],
      gender: child.gender,
      nationalIdentity: child.national_identity,
      otherInfo: child.other_info
    };
  }
  
  async getAllChildren(userId: string): Promise<Array<ChildData & { id: string }>> {
    const result = await pool.query(
      'SELECT * FROM children WHERE user_id = $1 ORDER BY name',
      [userId]
    );
    
    return result.rows.map(child => ({
      id: child.id,
      name: child.name,
      birthDate: child.birth_date.toISOString().split('T')[0],
      gender: child.gender,
      nationalIdentity: child.national_identity,
      otherInfo: child.other_info
    }));
  }
}
