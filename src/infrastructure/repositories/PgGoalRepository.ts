import pool from '../database/connection';
import { Goal, GoalProps, GoalDomain, GoalStatus } from '../../domain/entities/Goal';
import {
  GoalRepository,
  GoalCreateInput,
  GoalUpdateInput,
  GoalFilters,
} from '../../domain/repositories/GoalRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'goals',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    domain: col.required('domain', read.raw<GoalDomain>()),
    title: col.required('title', read.text),
    description: col.nullable('description', read.textOrNull),
    masteryCriteria: col.nullable('mastery_criteria', read.textOrNull),
    baselineValue: col.nullable('baseline_value', read.numberOrNull),
    targetValue: col.nullable('target_value', read.numberOrNull),
    unit: col.required('unit', read.textOrNull),
    status: col.required('status', read.raw<GoalStatus>(), { insertDefault: 'active' }),
    targetDate: col.nullable('target_date', read.rawOrNull<string>()),
    // A meta pode nascer de um plano educacional, mas não muda de origem
    // depois — `GoalUpdateInput` não tem o campo.
    sourceEducationPlanId: col.immutable('source_education_plan_id', read.textOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<GoalProps>,
  filters: { childId: ['child_id'], domain: ['domain'], status: ['status'] },
});

export class PgGoalRepository implements GoalRepository {
  private toEntity(row: Record<string, unknown>): Goal {
    return new Goal(TABLE.mapRow(row));
  }

  async save(input: GoalCreateInput): Promise<Goal> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Goal | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: GoalFilters): Promise<Goal[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM goals WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: GoalUpdateInput): Promise<Goal | null> {
    const statement = TABLE.update(id, userId, input);
    if (!statement) return this.findById(id, userId);
    const result = await pool.query(statement.sql, statement.params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { sql, params } = TABLE.deleteById(id, userId);
    const result = await pool.query(sql, params);
    return (result.rowCount ?? 0) > 0;
  }
}
