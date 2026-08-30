import pool from '../database/connection';
import {
  SchoolCommunication,
  SchoolCommunicationProps,
  SchoolCommType,
} from '../../domain/entities/SchoolCommunication';
import {
  SchoolCommunicationRepository,
  SchoolCommunicationCreateInput,
  SchoolCommunicationUpdateInput,
  SchoolCommunicationFilters,
  SchoolCommunicationSummary,
} from '../../domain/repositories/SchoolCommunicationRepository';
import { col, ColumnsFor, defineTable, read } from './defineTable';

const TABLE = defineTable({
  table: 'school_communications',
  columns: {
    id: col.immutable('id', read.text),
    userId: col.immutable('user_id', read.text),
    authorUserId: col.immutable('author_user_id', read.textOrNull),
    childId: col.immutable('child_id', read.text),
    occurredAt: col.required('occurred_at', read.timestamp),
    commType: col.required('comm_type', read.raw<SchoolCommType>()),
    subject: col.required('subject', read.text),
    description: col.nullable('description', read.textOrNull),
    attendees: col.nullable('attendees', read.textOrNull),
    followUpDate: col.nullable('follow_up_date', read.rawOrNull<string>()),
    notes: col.nullable('notes', read.textOrNull),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  } satisfies ColumnsFor<SchoolCommunicationProps>,
  filters: {
    childId: ['child_id'],
    commType: ['comm_type'],
    from: ['occurred_at', '>='],
    to: ['occurred_at', '<='],
  },
});

/** A projeção da listagem: as colunas do SELECT e a leitura da linha saem daqui. */
const SUMMARY = [
  'id',
  'childId',
  'occurredAt',
  'commType',
  'subject',
  'attendees',
  'followUpDate',
  'createdAt',
] as const;

export class PgSchoolCommunicationRepository implements SchoolCommunicationRepository {
  private toEntity(row: Record<string, unknown>): SchoolCommunication {
    return new SchoolCommunication(TABLE.mapRow(row));
  }

  async save(input: SchoolCommunicationCreateInput): Promise<SchoolCommunication> {
    const { sql, params } = TABLE.insert(input);
    const result = await pool.query(sql, params);
    return this.toEntity(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<SchoolCommunication | null> {
    const { sql, params } = TABLE.selectById(id, userId);
    const result = await pool.query(sql, params);
    return result.rows.length === 0 ? null : this.toEntity(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: SchoolCommunicationFilters,
  ): Promise<{ data: SchoolCommunicationSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const { where, params } = TABLE.listWhere(userId, filters);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM school_communications WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ${TABLE.columnsOf(SUMMARY)}
       FROM school_communications
       WHERE ${where}
       ORDER BY occurred_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: dataResult.rows.map(
        (row) => TABLE.pick(row, SUMMARY) satisfies SchoolCommunicationSummary,
      ),
      total: Number(countResult.rows[0].count),
      page,
      limit,
    };
  }

  async update(
    id: string,
    userId: string,
    input: SchoolCommunicationUpdateInput,
  ): Promise<SchoolCommunication | null> {
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
