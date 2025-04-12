import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';

export interface SectionComment {
  section: string;
  comments: string;
}

export class SectionCommentService {
  async saveSectionComments(assessmentId: string, comments: SectionComment[]): Promise<void> {
    if (!comments || comments.length === 0) return;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const comment of comments) {
        await client.query(
          `INSERT INTO section_comments (
            id, assessment_id, section_name, comments
          ) VALUES ($1, $2, $3, $4)`,
          [
            uuidv7(),
            assessmentId,
            comment.section,
            comment.comments
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
