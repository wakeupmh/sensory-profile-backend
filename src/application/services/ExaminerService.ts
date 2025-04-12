import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';

export interface ExaminerData {
  name: string;
  profession: string;
  contact?: string;
}

export class ExaminerService {
  async createExaminer(examinerData: ExaminerData): Promise<string | null> {
    if (!examinerData) return null;
    
    // Check if an examiner with the same name and profession already exists
    const existingExaminer = await pool.query(
      'SELECT id FROM examiners WHERE name = $1 AND profession = $2',
      [examinerData.name, examinerData.profession]
    );
    
    if (existingExaminer.rows.length > 0) {
      const examinerId = existingExaminer.rows[0].id;
      
      // Update the existing examiner with new contact info if provided
      if (examinerData.contact) {
        await pool.query(
          `UPDATE examiners SET 
            contact = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
          [examinerData.contact, examinerId]
        );
      }
      
      return examinerId;
    }
    
    // Create a new examiner
    const examinerId = uuidv7();
    await pool.query(
      `INSERT INTO examiners (
        id, name, profession, contact
      ) VALUES ($1, $2, $3, $4)`,
      [
        examinerId,
        examinerData.name,
        examinerData.profession,
        examinerData.contact || null
      ]
    );
    
    return examinerId;
  }
  
  async getExaminerById(examinerId: string): Promise<ExaminerData | null> {
    const result = await pool.query(
      'SELECT * FROM examiners WHERE id = $1',
      [examinerId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const examiner = result.rows[0];
    return {
      name: examiner.name,
      profession: examiner.profession,
      contact: examiner.contact
    };
  }
  
  async getAllExaminers(): Promise<Array<ExaminerData & { id: string }>> {
    const result = await pool.query(
      'SELECT * FROM examiners ORDER BY name'
    );
    
    return result.rows.map(examiner => ({
      id: examiner.id,
      name: examiner.name,
      profession: examiner.profession,
      contact: examiner.contact
    }));
  }
}
