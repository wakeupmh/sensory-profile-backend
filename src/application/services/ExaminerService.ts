import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';
import { PoolClient } from 'pg';

export interface ExaminerData {
  name: string;
  profession: string;
  contact?: string;
}

export class ExaminerService {
  async createExaminer(examinerData: ExaminerData, userId: string, externalClient?: PoolClient): Promise<string | null> {
    if (!examinerData) return null;

    const queryable = externalClient ?? pool;
    const examinerId = uuidv7();
    const result = await queryable.query(
      `INSERT INTO examiners (id, name, profession, contact, user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name, profession, user_id) DO UPDATE SET
         contact = COALESCE(EXCLUDED.contact, examiners.contact),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [examinerId, examinerData.name, examinerData.profession, examinerData.contact || null, userId]
    );

    return result.rows[0].id;
  }

}
