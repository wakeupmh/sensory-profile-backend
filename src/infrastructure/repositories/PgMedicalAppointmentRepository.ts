import pool from '../database/connection';
import {
  MedicalAppointment,
  MedicalAppointmentProps,
  MedicalAppointmentSummary,
} from '../../domain/entities/MedicalAppointment';
import {
  MedicalAppointmentRepository,
  MedicalAppointmentCreateInput,
  MedicalAppointmentUpdateInput,
  MedicalAppointmentFilters,
} from '../../domain/repositories/MedicalAppointmentRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'medical_appointments',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    doctorName: col.nullable('doctor_name', read.textOrNull),
    specialty: col.nullable('specialty', read.textOrNull),
    clinicName: col.nullable('clinic_name', read.textOrNull),
    occurredAt: col.required('occurred_at', read.timestamp),
    summary: col.nullable('summary', read.textOrNull),
    followUpDate: col.nullable('follow_up_date', read.rawOrNull<string>()),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<MedicalAppointmentProps>,
  filters: { childId: ['child_id'], from: ['occurred_at', '>='], to: ['occurred_at', '<='] },
});

/** A projeção da listagem: as colunas do SELECT e a leitura da linha saem daqui. */
const SUMMARY = [
  'id',
  'childId',
  'doctorName',
  'specialty',
  'clinicName',
  'occurredAt',
  'summary',
  'followUpDate',
  'createdAt',
] as const;

export class PgMedicalAppointmentRepository implements MedicalAppointmentRepository {
  private toEntity(row: Record<string, unknown>): MedicalAppointment {
    return new MedicalAppointment(TABLE.mapRow(row));
  }

  async save(input: MedicalAppointmentCreateInput): Promise<MedicalAppointment> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<MedicalAppointment | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: MedicalAppointmentFilters,
  ): Promise<{ data: MedicalAppointmentSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const { where, params } = TABLE.listWhere(userId, filters);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM medical_appointments WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ${TABLE.columnsOf(SUMMARY)}
       FROM medical_appointments
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows.map(
        (row) => TABLE.pick(row, SUMMARY) satisfies MedicalAppointmentSummary,
      ),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(
    id: string,
    userId: string,
    input: MedicalAppointmentUpdateInput,
  ): Promise<MedicalAppointment | null> {
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
