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

    const examinerId = uuidv7();
    const result = await pool.query(
      `INSERT INTO examiners (id, name, profession, contact)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name, profession) DO UPDATE SET
         contact = COALESCE(EXCLUDED.contact, examiners.contact),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [examinerId, examinerData.name, examinerData.profession, examinerData.contact || null]
    );

    return result.rows[0].id;
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
  
  async getAllExaminers(userId: string): Promise<Array<ExaminerData & { id: string }>> {
    const result = await pool.query(
      `SELECT * FROM examiners
       WHERE id IN (SELECT examiner_id FROM sensory_assessments WHERE user_id = $1)
       ORDER BY name`,
      [userId]
    );

    return result.rows.map(examiner => ({
      id: examiner.id,
      name: examiner.name,
      profession: examiner.profession,
      contact: examiner.contact
    }));
  }
}
