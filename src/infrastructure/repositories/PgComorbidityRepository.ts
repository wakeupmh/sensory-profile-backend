import pool from '../database/connection';
import { Comorbidity, ComorbidityProps } from '../../domain/entities/Comorbidity';
import {
  ComorbidityRepository,
  ComorbidityCreateInput,
  ComorbidityUpdateInput,
} from '../../domain/repositories/ComorbidityRepository';

export class PgComorbidityRepository implements ComorbidityRepository {
  private mapRowToComorbidity(row: Record<string, unknown>): Comorbidity {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      conditionName: row.condition_name as string,
      icdCode: row.icd_code as string | null,
      diagnosisDate: row.diagnosis_date as string | null,
      diagnosingDoctor: row.diagnosing_doctor as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies ComorbidityProps;
    return new Comorbidity(props);
  }

  async save(input: ComorbidityCreateInput): Promise<Comorbidity> {
    const result = await pool.query(
      `INSERT INTO comorbidities
         (id, user_id, child_id, condition_name, icd_code, diagnosis_date, diagnosing_doctor, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.conditionName,
        input.icdCode ?? null,
        input.diagnosisDate ?? null,
        input.diagnosingDoctor ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToComorbidity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Comorbidity | null> {
    const result = await pool.query(
      `SELECT * FROM comorbidities WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToComorbidity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: { childId?: string }): Promise<Comorbidity[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const result = await pool.query(
      `SELECT * FROM comorbidities WHERE ${where} ORDER BY condition_name ASC`,
      params,
    );
    return result.rows.map((row) => this.mapRowToComorbidity(row));
  }

  async update(id: string, userId: string, input: ComorbidityUpdateInput): Promise<Comorbidity | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.conditionName !== undefined) {
      params.push(input.conditionName);
      setClauses.push(`condition_name = $${params.length}`);
    }
    if ('icdCode' in input) {
      params.push(input.icdCode ?? null);
      setClauses.push(`icd_code = $${params.length}`);
    }
    if ('diagnosisDate' in input) {
      params.push(input.diagnosisDate ?? null);
      setClauses.push(`diagnosis_date = $${params.length}`);
    }
    if ('diagnosingDoctor' in input) {
      params.push(input.diagnosingDoctor ?? null);
      setClauses.push(`diagnosing_doctor = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE comorbidities
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToComorbidity(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM comorbidities WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
