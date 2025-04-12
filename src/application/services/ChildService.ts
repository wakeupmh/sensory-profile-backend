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
    // If nationalIdentity is provided, try to find the child by it
    if (childData.nationalIdentity) {
      const existingChild = await pool.query(
        'SELECT id FROM children WHERE national_identity = $1 AND user_id = $2',
        [childData.nationalIdentity, userId]
      );
      
      if (existingChild.rows.length > 0) {
        const childId = existingChild.rows[0].id;
        
        // Update the existing child with new data
        await pool.query(
          `UPDATE children SET 
            name = $1, 
            birth_date = $2, 
            gender = $3, 
            other_info = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5`,
          [
            childData.name,
            childData.birthDate,
            childData.gender || null,
            childData.otherInfo || null,
            childId
          ]
        );
        
        return childId;
      }
    }
    
    // Create a new child
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
        childData.nationalIdentity || null,
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
