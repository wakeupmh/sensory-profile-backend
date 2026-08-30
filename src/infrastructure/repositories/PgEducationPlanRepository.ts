import pool from '../database/connection';
import {
  EducationPlan,
  EducationPlanProps,
  EducationPlanType,
} from '../../domain/entities/EducationPlan';
import {
  EducationPlanRepository,
  EducationPlanCreateInput,
  EducationPlanUpdateInput,
  EducationPlanFilters,
} from '../../domain/repositories/EducationPlanRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'education_plans',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    schoolName: col.required('school_name', read.text),
    academicYear: col.required('academic_year', read.text),
    planType: col.required('plan_type', read.raw<EducationPlanType>()),
    startDate: col.required('start_date', read.raw<string>()),
    reviewDate: col.nullable('review_date', read.rawOrNull<string>()),
    endDate: col.nullable('end_date', read.rawOrNull<string>()),
    goals: col.nullable('goals', read.textOrNull),
    accommodations: col.nullable('accommodations', read.textOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<EducationPlanProps>,
  // `education_plans` é child-scoped, e esta listagem NÃO passava por
  // `buildWhere`: montava `user_id = $1` à mão, então a concessão do care team
  // não a alcançava.
  filters: {
    childId: ['child_id'],
    planType: ['plan_type'],
    academicYear: ['academic_year'],
  },
});

export class PgEducationPlanRepository implements EducationPlanRepository {
  private toEntity(row: Record<string, unknown>): EducationPlan {
    return new EducationPlan(TABLE.mapRow(row));
  }

  async save(input: EducationPlanCreateInput): Promise<EducationPlan> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<EducationPlan | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: EducationPlanFilters): Promise<EducationPlan[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM education_plans WHERE ${where} ORDER BY start_date DESC, created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(
    id: string,
    userId: string,
    input: EducationPlanUpdateInput,
  ): Promise<EducationPlan | null> {
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
