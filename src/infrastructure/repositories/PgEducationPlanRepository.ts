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

export class PgEducationPlanRepository implements EducationPlanRepository {
  private mapRow(row: Record<string, unknown>): EducationPlan {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      schoolName: row.school_name as string,
      academicYear: row.academic_year as string,
      planType: row.plan_type as EducationPlanType,
      startDate: row.start_date as string,
      reviewDate: row.review_date as string | null,
      endDate: row.end_date as string | null,
      goals: row.goals as string | null,
      accommodations: row.accommodations as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies EducationPlanProps;
    return new EducationPlan(props);
  }

  async save(input: EducationPlanCreateInput): Promise<EducationPlan> {
    const result = await pool.query(
      `INSERT INTO education_plans
         (id, user_id, child_id, school_name, academic_year, plan_type, start_date, review_date, end_date, goals, accommodations, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.schoolName,
        input.academicYear,
        input.planType,
        input.startDate,
        input.reviewDate ?? null,
        input.endDate ?? null,
        input.goals ?? null,
        input.accommodations ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<EducationPlan | null> {
    const result = await pool.query(
      `SELECT * FROM education_plans WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: EducationPlanFilters): Promise<EducationPlan[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.planType) {
      params.push(filters.planType);
      conditions.push(`plan_type = $${params.length}`);
    }
    if (filters.academicYear) {
      params.push(filters.academicYear);
      conditions.push(`academic_year = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const result = await pool.query(
      `SELECT * FROM education_plans WHERE ${where} ORDER BY start_date DESC, created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async update(
    id: string,
    userId: string,
    input: EducationPlanUpdateInput,
  ): Promise<EducationPlan | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.schoolName !== undefined) { sets.push(`school_name = $${idx++}`); params.push(input.schoolName); }
    if (input.academicYear !== undefined) { sets.push(`academic_year = $${idx++}`); params.push(input.academicYear); }
    if (input.planType !== undefined) { sets.push(`plan_type = $${idx++}`); params.push(input.planType); }
    if (input.startDate !== undefined) { sets.push(`start_date = $${idx++}`); params.push(input.startDate); }
    if ('reviewDate' in input) { sets.push(`review_date = $${idx++}`); params.push(input.reviewDate ?? null); }
    if ('endDate' in input) { sets.push(`end_date = $${idx++}`); params.push(input.endDate ?? null); }
    if ('goals' in input) { sets.push(`goals = $${idx++}`); params.push(input.goals ?? null); }
    if ('accommodations' in input) { sets.push(`accommodations = $${idx++}`); params.push(input.accommodations ?? null); }
    if ('notes' in input) { sets.push(`notes = $${idx++}`); params.push(input.notes ?? null); }

    if (sets.length === 0) return this.findById(id, userId);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE education_plans
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM education_plans WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
