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
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'developmental_milestones',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    title: col.required('title', read.text),
    category: col.required('category', read.raw<MilestoneCategory>()),
    status: col.required('status', read.raw<MilestoneStatus>(), { insertDefault: 'not_yet' }),
    achievedDate: col.nullable('achieved_date', read.rawOrNull<string>()),
    targetDate: col.nullable('target_date', read.rawOrNull<string>()),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<DevelopmentalMilestoneProps>,
  filters: { childId: ['child_id'], category: ['category'], status: ['status'] },
});

export class PgDevelopmentalMilestoneRepository implements DevelopmentalMilestoneRepository {
  private toEntity(row: Record<string, unknown>): DevelopmentalMilestone {
    return new DevelopmentalMilestone(TABLE.mapRow(row));
  }

  async save(input: MilestoneCreateInput): Promise<DevelopmentalMilestone> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<DevelopmentalMilestone | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: MilestoneFilters): Promise<DevelopmentalMilestone[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM developmental_milestones WHERE ${where} ORDER BY title ASC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(
    id: string,
    userId: string,
    input: MilestoneUpdateInput,
  ): Promise<DevelopmentalMilestone | null> {
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
