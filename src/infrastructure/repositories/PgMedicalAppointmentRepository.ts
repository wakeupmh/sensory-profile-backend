import pool from '../database/connection';
import { MedicalAppointment, MedicalAppointmentProps, MedicalAppointmentSummary } from '../../domain/entities/MedicalAppointment';
import {
  MedicalAppointmentRepository,
  MedicalAppointmentCreateInput,
  MedicalAppointmentUpdateInput,
  MedicalAppointmentFilters,
} from '../../domain/repositories/MedicalAppointmentRepository';

export class PgMedicalAppointmentRepository implements MedicalAppointmentRepository {
  private mapRowToAppointment(row: Record<string, unknown>): MedicalAppointment {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      doctorName: row.doctor_name as string | null,
      specialty: row.specialty as string | null,
      clinicName: row.clinic_name as string | null,
      occurredAt: new Date(row.occurred_at as string),
      summary: row.summary as string | null,
      followUpDate: row.follow_up_date as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies MedicalAppointmentProps;
    return new MedicalAppointment(props);
  }

  private mapRowToSummary(row: Record<string, unknown>): MedicalAppointmentSummary {
    return {
      id: row.id as string,
      childId: row.child_id as string,
      doctorName: row.doctor_name as string | null,
      specialty: row.specialty as string | null,
      clinicName: row.clinic_name as string | null,
      occurredAt: new Date(row.occurred_at as string),
      summary: row.summary as string | null,
      followUpDate: row.follow_up_date as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  async save(input: MedicalAppointmentCreateInput): Promise<MedicalAppointment> {
    const result = await pool.query(
      `INSERT INTO medical_appointments
         (id, user_id, child_id, doctor_name, specialty, clinic_name, occurred_at, summary, follow_up_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.doctorName ?? null,
        input.specialty ?? null,
        input.clinicName ?? null,
        input.occurredAt,
        input.summary ?? null,
        input.followUpDate ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToAppointment(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<MedicalAppointment | null> {
    const result = await pool.query(
      `SELECT * FROM medical_appointments WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToAppointment(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: MedicalAppointmentFilters,
  ): Promise<{ data: MedicalAppointmentSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.from) {
      params.push(filters.from);
      conditions.push(`occurred_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      conditions.push(`occurred_at <= $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM medical_appointments WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, child_id, doctor_name, specialty, clinic_name, occurred_at, summary, follow_up_date, created_at
       FROM medical_appointments
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows.map((row) => this.mapRowToSummary(row)),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(id: string, userId: string, input: MedicalAppointmentUpdateInput): Promise<MedicalAppointment | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if ('doctorName' in input) {
      params.push(input.doctorName ?? null);
      setClauses.push(`doctor_name = $${params.length}`);
    }
    if ('specialty' in input) {
      params.push(input.specialty ?? null);
      setClauses.push(`specialty = $${params.length}`);
    }
    if ('clinicName' in input) {
      params.push(input.clinicName ?? null);
      setClauses.push(`clinic_name = $${params.length}`);
    }
    if (input.occurredAt !== undefined) {
      params.push(input.occurredAt);
      setClauses.push(`occurred_at = $${params.length}`);
    }
    if ('summary' in input) {
      params.push(input.summary ?? null);
      setClauses.push(`summary = $${params.length}`);
    }
    if ('followUpDate' in input) {
      params.push(input.followUpDate ?? null);
      setClauses.push(`follow_up_date = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE medical_appointments
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToAppointment(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM medical_appointments WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
