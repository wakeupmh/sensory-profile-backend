import pool from '../database/connection';
import { Comorbidity, ComorbidityProps } from '../../domain/entities/Comorbidity';
import {
  ComorbidityRepository,
  ComorbidityCreateInput,
  ComorbidityUpdateInput,
} from '../../domain/repositories/ComorbidityRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'comorbidities',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    conditionName: col.required('condition_name', read.text),
    icdCode: col.nullable('icd_code', read.textOrNull),
    diagnosisDate: col.nullable('diagnosis_date', read.rawOrNull<string>()),
    diagnosingDoctor: col.nullable('diagnosing_doctor', read.textOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<ComorbidityProps>,
  filters: { childId: ['child_id'] },
});

export class PgComorbidityRepository implements ComorbidityRepository {
  private toEntity(row: Record<string, unknown>): Comorbidity {
    return new Comorbidity(TABLE.mapRow(row));
  }

  async save(input: ComorbidityCreateInput): Promise<Comorbidity> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Comorbidity | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string, filters: { childId?: string }): Promise<Comorbidity[]> {
    const { where, params } = TABLE.listWhere(userId, filters);
    const result = await pool.query(
      `SELECT * FROM comorbidities WHERE ${where} ORDER BY condition_name ASC`,
      params,
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: ComorbidityUpdateInput): Promise<Comorbidity | null> {
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
