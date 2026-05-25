import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';
import { PoolClient } from 'pg';

export interface SectionComment {
  section: string;
  comments: string;
}

export class SectionCommentService {
  async deleteByAssessmentId(assessmentId: string, externalClient?: PoolClient, userId?: string): Promise<void> {
    const queryable = externalClient ?? pool;
    if (userId) {
      await queryable.query(
        `DELETE FROM section_comments sc
         WHERE sc.assessment_id = $1
           AND EXISTS (SELECT 1 FROM sensory_assessments sa WHERE sa.id = sc.assessment_id AND sa.user_id = $2)`,
        [assessmentId, userId]
      );
    } else {
      await queryable.query('DELETE FROM section_comments WHERE assessment_id = $1', [assessmentId]);
    }
  }

  async saveSectionComments(assessmentId: string, comments: SectionComment[], externalClient?: PoolClient): Promise<void> {
    if (!comments || comments.length === 0) return;

    const values: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;
    for (const comment of comments) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      params.push(uuidv7(), assessmentId, comment.section, comment.comments);
      idx += 4;
    }

    const sql = `INSERT INTO section_comments (id, assessment_id, section_name, comments) VALUES ${values.join(', ')}`;

    // When an external client (shared transaction) is provided, skip
    // local transaction management — the caller owns BEGIN/COMMIT/ROLLBACK.
    if (externalClient) {
      await externalClient.query(sql, params);
      return;
    }

    // Stand-alone path: manage our own transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql, params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
