import pool from '../database/connection';
import {
  DevelopmentalMilestone,
  DevelopmentalMilestoneProps,
  MilestoneCategory,
  MilestoneStatus,
} from '../../domain/entities/DevelopmentalMilestone';
import {
  DevelopmentalMilestoneRepository,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  MilestoneFilters,
} from '../../domain/repositories/DevelopmentalMilestoneRepository';
import { buildWhere, FilterSpec } from './queryUtils';

const FILTER_MAP: Record<string, FilterSpec> = {
  childId: ['child_id'],
  category: ['category'],
  status: ['status'],
};

export class PgDevelopmentalMilestoneRepository implements DevelopmentalMilestoneRepository {
  private mapRowToMilestone(row: Record<string, unknown>): DevelopmentalMilestone {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      title: row.title as string,
      category: row.category as MilestoneCategory,
      status: row.status as MilestoneStatus,
      achievedDate: row.achieved_date as string | null,
      targetDate: row.target_date as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies DevelopmentalMilestoneProps;
    return new DevelopmentalMilestone(props);
  }

  async save(input: MilestoneCreateInput): Promise<DevelopmentalMilestone> {
    const result = await pool.query(
      `INSERT INTO developmental_milestones
         (id, user_id, child_id, title, category, status, achieved_date, target_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.title,
        input.category,
        input.status ?? 'not_yet',
        input.achievedDate ?? null,
        input.targetDate ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToMilestone(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<DevelopmentalMilestone | null> {
    const result = await pool.query(
      `SELECT * FROM developmental_milestones WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToMilestone(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: MilestoneFilters): Promise<DevelopmentalMilestone[]> {
    const { where, params } = buildWhere(userId, filters as unknown as Record<string, unknown>, FILTER_MAP);
    const result = await pool.query(
      `SELECT * FROM developmental_milestones WHERE ${where} ORDER BY title ASC`,
      params,
    );
    return result.rows.map((row) => this.mapRowToMilestone(row));
  }

  async update(
    id: string,
    userId: string,
    input: MilestoneUpdateInput,
  ): Promise<DevelopmentalMilestone | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.title !== undefined) {
      params.push(input.title);
      setClauses.push(`title = $${params.length}`);
    }
    if (input.category !== undefined) {
      params.push(input.category);
      setClauses.push(`category = $${params.length}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${params.length}`);
    }
    if ('achievedDate' in input) {
      params.push(input.achievedDate ?? null);
      setClauses.push(`achieved_date = $${params.length}`);
    }
    if ('targetDate' in input) {
      params.push(input.targetDate ?? null);
      setClauses.push(`target_date = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE developmental_milestones
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToMilestone(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM developmental_milestones WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
