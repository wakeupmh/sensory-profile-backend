import pool from '../database/connection';
import { Goal, GoalProps, GoalDomain, GoalStatus } from '../../domain/entities/Goal';
import {
  GoalRepository,
  GoalCreateInput,
  GoalUpdateInput,
  GoalFilters,
} from '../../domain/repositories/GoalRepository';
import { buildWhere, FilterSpec } from './queryUtils';

const FILTER_MAP: Record<string, FilterSpec> = {
  childId: ['child_id'],
  domain: ['domain'],
  status: ['status'],
};

export class PgGoalRepository implements GoalRepository {
  private mapRow(row: Record<string, unknown>): Goal {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      domain: row.domain as GoalDomain,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      masteryCriteria: (row.mastery_criteria as string | null) ?? null,
      baselineValue: row.baseline_value == null ? null : Number(row.baseline_value),
      targetValue: row.target_value == null ? null : Number(row.target_value),
      unit: (row.unit as string | null) ?? null,
      status: row.status as GoalStatus,
      targetDate: (row.target_date as string | null) ?? null,
      sourceEducationPlanId: (row.source_education_plan_id as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies GoalProps;
    return new Goal(props);
  }

  async save(input: GoalCreateInput): Promise<Goal> {
    const result = await pool.query(
      `INSERT INTO goals
         (id, user_id, child_id, domain, title, description, mastery_criteria,
          baseline_value, target_value, unit, status, target_date,
          source_education_plan_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.domain,
        input.title,
        input.description ?? null,
        input.masteryCriteria ?? null,
        input.baselineValue ?? null,
        input.targetValue ?? null,
        input.unit ?? null,
        input.status ?? 'active',
        input.targetDate ?? null,
        input.sourceEducationPlanId ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Goal | null> {
    const result = await pool.query(`SELECT * FROM goals WHERE id = $1 AND user_id = $2`, [id, userId]);
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: GoalFilters): Promise<Goal[]> {
    const { where, params } = buildWhere(userId, filters as unknown as Record<string, unknown>, FILTER_MAP);
    const result = await pool.query(
      `SELECT * FROM goals WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(id: string, userId: string, input: GoalUpdateInput): Promise<Goal | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    const setIfDefined = (key: keyof GoalUpdateInput, column: string) => {
      if (input[key] !== undefined) {
        params.push(input[key]);
        setClauses.push(`${column} = $${params.length}`);
      }
    };

    setIfDefined('domain', 'domain');
    setIfDefined('title', 'title');
    setIfDefined('status', 'status');
    setIfDefined('unit', 'unit');

    if ('description' in input) { params.push(input.description ?? null); setClauses.push(`description = $${params.length}`); }
    if ('masteryCriteria' in input) { params.push(input.masteryCriteria ?? null); setClauses.push(`mastery_criteria = $${params.length}`); }
    if ('baselineValue' in input) { params.push(input.baselineValue ?? null); setClauses.push(`baseline_value = $${params.length}`); }
    if ('targetValue' in input) { params.push(input.targetValue ?? null); setClauses.push(`target_value = $${params.length}`); }
    if ('targetDate' in input) { params.push(input.targetDate ?? null); setClauses.push(`target_date = $${params.length}`); }
    if ('notes' in input) { params.push(input.notes ?? null); setClauses.push(`notes = $${params.length}`); }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE goals
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
