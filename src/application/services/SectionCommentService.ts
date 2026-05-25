import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';
import { PoolClient } from 'pg';

export interface SectionComment {
  section: string;
  comments: string;
}

export class SectionCommentService {
  async deleteByAssessmentId(assessmentId: string, externalClient?: PoolClient): Promise<void> {
    const queryable = externalClient ?? pool;
    await queryable.query('DELETE FROM section_comments WHERE assessment_id = $1', [assessmentId]);
  }

  async saveSectionComments(assessmentId: string, comments: SectionComment[], externalClient?: PoolClient): Promise<void> {
    if (!comments || comments.length === 0) return;

    // When an external client (shared transaction) is provided, skip
    // local transaction management — the caller owns BEGIN/COMMIT/ROLLBACK.
    if (externalClient) {
      for (const comment of comments) {
        await externalClient.query(
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
      return;
    }

    // Stand-alone path: manage our own transaction
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
