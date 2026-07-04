import pool from '../database/connection';
import { AiSummary, AiSummaryProps } from '../../domain/entities/AiSummary';
import { AiSummaryRepository, AiSummaryCreateInput } from '../../domain/repositories/AiSummaryRepository';

export class PgAiSummaryRepository implements AiSummaryRepository {
  private mapRow(row: Record<string, unknown>): AiSummary {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      periodFrom: new Date(row.period_from as string),
      periodTo: new Date(row.period_to as string),
      modelId: row.model_id as string,
      content: row.content as string,
      createdAt: new Date(row.created_at as string),
    } satisfies AiSummaryProps;
    return new AiSummary(props);
  }

  async save(input: AiSummaryCreateInput): Promise<AiSummary> {
    const result = await pool.query(
      `INSERT INTO ai_summaries (id, user_id, child_id, period_from, period_to, model_id, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.id, input.userId, input.childId, input.periodFrom, input.periodTo, input.modelId, input.content],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<AiSummary | null> {
    const result = await pool.query(`SELECT * FROM ai_summaries WHERE id = $1 AND user_id = $2`, [id, userId]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByChild(childId: string, userId: string): Promise<AiSummary[]> {
    const result = await pool.query(
      `SELECT * FROM ai_summaries WHERE child_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50`,
      [childId, userId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }
}
