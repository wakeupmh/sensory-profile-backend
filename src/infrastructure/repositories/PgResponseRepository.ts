import { Response } from '../../domain/entities/Response';
import { ResponseRepository } from '../../domain/repositories/ResponseRepository';
import pool from '../database/connection';
import { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

export class PgResponseRepository implements ResponseRepository {
  async findByAssessmentId(assessmentId: string, userId?: string): Promise<Response[]> {
    // If userId is provided, we verify that the assessment belongs to the user
    if (userId) {
      const assessmentCheck = await pool.query(
        'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
        [assessmentId, userId]
      );
      
      if (assessmentCheck.rows.length === 0) {
        return [];
      }
    }
    
    const result = await pool.query(
      'SELECT * FROM sensory_responses WHERE assessment_id = $1',
      [assessmentId]
    );

    return result.rows.map(row => this.mapRowToResponse(row));
  }

  async save(response: Response, userId: string): Promise<Response> {
    // Verify that the assessment belongs to the user
    const assessmentCheck = await pool.query(
      'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
      [response.getAssessmentId(), userId]
    );
    
    if (assessmentCheck.rows.length === 0) {
      throw new Error(`Assessment with ID ${response.getAssessmentId()} not found for this user`);
    }
    
    const id = response.getId() || uuidv7();
    
    const result = await pool.query(
      `INSERT INTO sensory_responses (
        id, assessment_id, item_id, response
      ) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        id,
        response.getAssessmentId(),
        response.getItemId(),
        response.getResponse()
      ]
    );

    return this.mapRowToResponse(result.rows[0]);
  }

  async saveMany(responses: Response[], userId: string, externalClient?: PoolClient): Promise<Response[]> {
    if (responses.length === 0) {
      return [];
    }

    // When an external client (shared transaction) is provided, skip
    // local transaction management — the caller owns BEGIN/COMMIT/ROLLBACK.
    if (externalClient) {
      // Verify that the assessment belongs to the user
      const assessmentId = responses[0].getAssessmentId();
      const assessmentCheck = await externalClient.query(
        'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
        [assessmentId, userId]
      );
      if (assessmentCheck.rows.length === 0) {
        throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
      }

      // Single batched INSERT
      const { values, params } = this.buildBatchInsertValues(responses);
      const result = await externalClient.query(
        `INSERT INTO sensory_responses (id, assessment_id, item_id, response) VALUES ${values.join(', ')} RETURNING *`,
        params
      );
      return result.rows.map((row: any) => this.mapRowToResponse(row));
    }

    // Stand-alone path: manage our own transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify that the assessment belongs to the user
      const assessmentId = responses[0].getAssessmentId();
      const assessmentCheck = await client.query(
        'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
        [assessmentId, userId]
      );
      if (assessmentCheck.rows.length === 0) {
        throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
      }

      // Single batched INSERT
      const { values, params } = this.buildBatchInsertValues(responses);
      const result = await client.query(
        `INSERT INTO sensory_responses (id, assessment_id, item_id, response) VALUES ${values.join(', ')} RETURNING *`,
        params
      );

      await client.query('COMMIT');
      return result.rows.map((row: any) => this.mapRowToResponse(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    // First get the assessment_id for this response
    const responseQuery = await pool.query(
      'SELECT assessment_id FROM sensory_responses WHERE id = $1',
      [id]
    );
    
    if (responseQuery.rows.length === 0) {
      return; // Response doesn't exist, nothing to delete
    }
    
    const assessmentId = responseQuery.rows[0].assessment_id;
    
    // Verify that the assessment belongs to the user
    const assessmentCheck = await pool.query(
      'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
      [assessmentId, userId]
    );
    
    if (assessmentCheck.rows.length === 0) {
      throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
    }
    
    await pool.query('DELETE FROM sensory_responses WHERE id = $1', [id]);
  }

  async deleteByAssessmentId(assessmentId: string, userId: string, externalClient?: PoolClient): Promise<void> {
    const queryable = externalClient ?? pool;

    // Verify that the assessment belongs to the user
    const assessmentCheck = await queryable.query(
      'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
      [assessmentId, userId]
    );

    if (assessmentCheck.rows.length === 0) {
      throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
    }

    await queryable.query('DELETE FROM sensory_responses WHERE assessment_id = $1', [assessmentId]);
  }

  async replaceByAssessmentId(assessmentId: string, responses: Response[], userId: string, externalClient?: PoolClient): Promise<void> {
    // When an external client (shared transaction) is provided, skip
    // local transaction management — the caller owns BEGIN/COMMIT/ROLLBACK.
    if (externalClient) {
      const assessmentCheck = await externalClient.query(
        'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
        [assessmentId, userId]
      );
      if (assessmentCheck.rows.length === 0) {
        throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
      }

      await externalClient.query('DELETE FROM sensory_responses WHERE assessment_id = $1', [assessmentId]);

      if (responses.length > 0) {
        const { values, params } = this.buildBatchInsertValues(responses);
        await externalClient.query(
          `INSERT INTO sensory_responses (id, assessment_id, item_id, response) VALUES ${values.join(', ')}`,
          params
        );
      }
      return;
    }

    // Stand-alone path: manage our own transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const assessmentCheck = await client.query(
        'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
        [assessmentId, userId]
      );
      if (assessmentCheck.rows.length === 0) {
        throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
      }

      await client.query('DELETE FROM sensory_responses WHERE assessment_id = $1', [assessmentId]);

      if (responses.length > 0) {
        const { values, params } = this.buildBatchInsertValues(responses);
        await client.query(
          `INSERT INTO sensory_responses (id, assessment_id, item_id, response) VALUES ${values.join(', ')}`,
          params
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

  private buildBatchInsertValues(responses: Response[]): { values: string[]; params: (string | number)[] } {
    const values: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;
    for (const r of responses) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      params.push(r.getId() || uuidv7(), r.getAssessmentId(), r.getItemId(), r.getResponse());
      idx += 4;
    }
    return { values, params };
  }

  private mapRowToResponse(row: any): Response {
    return new Response(
      row.assessment_id,
      row.item_id,
      row.response,
      row.id,
      row.created_at
    );
  }
}
