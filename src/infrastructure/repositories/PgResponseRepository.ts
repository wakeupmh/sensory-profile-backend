import { Response } from '../../domain/entities/Response';
import { ResponseRepository } from '../../domain/repositories/ResponseRepository';
import pool from '../database/connection';
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

  async saveMany(responses: Response[], userId: string): Promise<Response[]> {
    if (responses.length === 0) {
      return [];
    }
    
    // Use a transaction to ensure all responses are saved or none
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

      const savedResponses: Response[] = [];
      for (const response of responses) {
        const id = response.getId() || uuidv7();
        
        const result = await client.query(
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
        savedResponses.push(this.mapRowToResponse(result.rows[0]));
      }

      await client.query('COMMIT');
      return savedResponses;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async update(response: Response, userId: string): Promise<Response> {
    // Verify that the assessment belongs to the user
    const assessmentCheck = await pool.query(
      'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
      [response.getAssessmentId(), userId]
    );
    
    if (assessmentCheck.rows.length === 0) {
      throw new Error(`Assessment with ID ${response.getAssessmentId()} not found for this user`);
    }
    
    const result = await pool.query(
      `UPDATE sensory_responses SET
        response = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *`,
      [
        response.getResponse(),
        response.getId()
      ]
    );

    if (result.rows.length === 0) {
      throw new Error(`Response with ID ${response.getId()} not found`);
    }

    return this.mapRowToResponse(result.rows[0]);
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

  async deleteByAssessmentId(assessmentId: string, userId: string): Promise<void> {
    // Verify that the assessment belongs to the user
    const assessmentCheck = await pool.query(
      'SELECT 1 FROM sensory_assessments WHERE id = $1 AND user_id = $2',
      [assessmentId, userId]
    );
    
    if (assessmentCheck.rows.length === 0) {
      throw new Error(`Assessment with ID ${assessmentId} not found for this user`);
    }
    
    await pool.query('DELETE FROM sensory_responses WHERE assessment_id = $1', [assessmentId]);
  }

  private mapRowToResponse(row: any): Response {
    return new Response(
      row.assessment_id,
      row.item_id,
      row.response,
      row.id,
      row.created_at,
      row.updated_at
    );
  }
}
