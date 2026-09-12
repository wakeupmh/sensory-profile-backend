import pool from '../database/connection';
import { Therapist, TherapistProps, TherapyType } from '../../domain/entities/Therapist';
import {
  TherapistRepository,
  TherapistCreateInput,
  TherapistUpdateInput,
} from '../../domain/repositories/TherapistRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'therapists',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    name: col.required('name', read.text),
    specialty: col.required('specialty', read.raw<TherapyType>()),
    phone: col.nullable('phone', read.textOrNull),
    email: col.nullable('email', read.textOrNull),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<TherapistProps>,
  // Sem mapa de filtros de propósito: `therapists` é da CONTA, não da criança,
  // e não tem coluna `child_id`. `buildWhere` acrescenta `child_id = $n` a uma
  // listagem cujo mapping não é child-scoped — contra esta tabela isso seria
  // SQL inválido. A listagem abaixo continua escrita à mão por esse motivo.
});

export class PgTherapistRepository implements TherapistRepository {
  private toEntity(row: Record<string, unknown>): Therapist {
    return new Therapist(TABLE.mapRow(row));
  }

  async save(input: TherapistCreateInput): Promise<Therapist> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Therapist | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(userId: string): Promise<Therapist[]> {
    const result = await pool.query(
      `SELECT * FROM therapists WHERE user_id = $1 ORDER BY name ASC`,
      [userId],
    );
    return result.rows.map((row) => this.toEntity(row));
  }

  async update(id: string, userId: string, input: TherapistUpdateInput): Promise<Therapist | null> {
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
