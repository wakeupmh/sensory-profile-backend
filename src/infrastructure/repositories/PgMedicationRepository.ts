import pool from '../database/connection';
import { Medication, MedicationProps } from '../../domain/entities/Medication';
import {
  MedicationRepository,
  MedicationCreateInput,
  MedicationUpdateInput,
  MedicationFilters,
} from '../../domain/repositories/MedicationRepository';

export class PgMedicationRepository implements MedicationRepository {
  private mapRowToMedication(row: Record<string, unknown>): Medication {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      name: row.name as string,
      dosage: row.dosage as string | null,
      frequency: row.frequency as string | null,
      startDate: row.start_date as string | null,
      endDate: row.end_date as string | null,
      prescribingDoctor: row.prescribing_doctor as string | null,
      active: row.active as boolean,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies MedicationProps;
    return new Medication(props);
  }

  async save(input: MedicationCreateInput): Promise<Medication> {
    const result = await pool.query(
      `INSERT INTO medications
         (id, user_id, child_id, name, dosage, frequency, start_date, end_date, prescribing_doctor, active, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.name,
        input.dosage ?? null,
        input.frequency ?? null,
        input.startDate ?? null,
        input.endDate ?? null,
        input.prescribingDoctor ?? null,
        input.active ?? true,
        input.notes ?? null,
      ],
    );
    return this.mapRowToMedication(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Medication | null> {
    const result = await pool.query(
      `SELECT * FROM medications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToMedication(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: MedicationFilters): Promise<Medication[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.active !== undefined) {
      params.push(filters.active);
      conditions.push(`active = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const result = await pool.query(
      `SELECT * FROM medications WHERE ${where} ORDER BY name ASC`,
      params,
    );
    return result.rows.map((row) => this.mapRowToMedication(row));
  }

  async update(id: string, userId: string, input: MedicationUpdateInput): Promise<Medication | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${params.length}`);
    }
    if ('dosage' in input) {
      params.push(input.dosage ?? null);
      setClauses.push(`dosage = $${params.length}`);
    }
    if ('frequency' in input) {
      params.push(input.frequency ?? null);
      setClauses.push(`frequency = $${params.length}`);
    }
    if ('startDate' in input) {
      params.push(input.startDate ?? null);
      setClauses.push(`start_date = $${params.length}`);
    }
    if ('endDate' in input) {
      params.push(input.endDate ?? null);
      setClauses.push(`end_date = $${params.length}`);
    }
    if ('prescribingDoctor' in input) {
      params.push(input.prescribingDoctor ?? null);
      setClauses.push(`prescribing_doctor = $${params.length}`);
    }
    if (input.active !== undefined) {
      params.push(input.active);
      setClauses.push(`active = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE medications
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToMedication(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM medications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
