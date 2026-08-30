import pool from '../database/connection';
import { AiSummary, AiSummaryProps } from '../../domain/entities/AiSummary';
import {
  AiSummaryRepository,
  AiSummaryCreateInput,
  AiSummaryListResult,
} from '../../domain/repositories/AiSummaryRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'ai_summaries',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    childId: col.immutable('child_id', read.text),
    periodFrom: col.immutable('period_from', read.timestamp),
    periodTo: col.immutable('period_to', read.timestamp),
    modelId: col.immutable('model_id', read.text),
    content: col.immutable('content', read.text),
    createdAt: col.createdAt(),
  } satisfies ColumnsFor<AiSummaryProps>,
  // O resumo gerado é imutável e a listagem é sempre POR CRIANÇA (nunca a
  // listagem genérica de `buildWhere`), então não há mapa de filtros.
});

export class PgAiSummaryRepository implements AiSummaryRepository {
  private toEntity(row: Record<string, unknown>): AiSummary {
    return new AiSummary(TABLE.mapRow(row));
  }

  async save(input: AiSummaryCreateInput): Promise<AiSummary> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<AiSummary | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByChild(childId: string, userId: string, page: number, limit: number): Promise<AiSummaryListResult> {
    const offset = (page - 1) * limit;
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM ai_summaries WHERE child_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [childId, userId, limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM ai_summaries WHERE child_id = $1 AND user_id = $2`, [
        childId,
        userId,
      ]),
    ]);
    return {
      data: dataResult.rows.map((row) => this.toEntity(row)),
      total: countResult.rows[0].count,
      page,
      limit,
    };
  }
}
