import pool from '../database/connection';
import { Medication, MedicationProps } from '../../domain/entities/Medication';
import {
  MedicationRepository,
  MedicationCreateInput,
  MedicationUpdateInput,
  MedicationFilters,
} from '../../domain/repositories/MedicationRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'medications',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    name: col.required('name', read.text),
    dosage: col.nullable('dosage', read.textOrNull),
    frequency: col.nullable('frequency', read.textOrNull),
    startDate: col.nullable('start_date', read.rawOrNull<string>()),
    endDate: col.nullable('end_date', read.rawOrNull<string>()),
    prescribingDoctor: col.nullable('prescribing_doctor', read.textOrNull),
    active: col.required('active', read.boolean, { insertDefault: true }),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<MedicationProps>,
  // `medications` é child-scoped, e esta listagem NÃO passava por `buildWhere`:
  // montava `user_id = $1` à mão, então a concessão do care team não a
  // alcançava — o profissional convidado via os logs e os documentos da
  // criança, mas nenhum medicamento.
  filters: { childId: ['child_id'], active: ['active'] },
});

export class PgMedicationRepository implements MedicationRepository {
  private toEntity(row: Record<string, unknown>): Medication {
    return new Medication(TABLE.mapRow(row));
  }

  async save(input: MedicationCreateInput): Promise<Medication> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Medication | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: MedicationFilters): Promise<Medication[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM medications WHERE ${where} ORDER BY name ASC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: MedicationUpdateInput): Promise<Medication | null> {
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
