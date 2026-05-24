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

export class PgSchoolCommunicationRepository implements SchoolCommunicationRepository {
  private mapRowToLog(row: Record<string, unknown>): SchoolCommunication {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      occurredAt: new Date(row.occurred_at as string),
      commType: row.comm_type as SchoolCommType,
      subject: row.subject as string,
      description: row.description as string | null,
      attendees: row.attendees as string | null,
      followUpDate: row.follow_up_date as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies SchoolCommunicationProps;
    return new SchoolCommunication(props);
  }

  private mapRowToSummary(row: Record<string, unknown>): SchoolCommunicationSummary {
    return {
      id: row.id as string,
      childId: row.child_id as string,
      occurredAt: new Date(row.occurred_at as string),
      commType: row.comm_type as SchoolCommType,
      subject: row.subject as string,
      attendees: row.attendees as string | null,
      followUpDate: row.follow_up_date as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  async save(input: SchoolCommunicationCreateInput): Promise<SchoolCommunication> {
    const result = await pool.query(
      `INSERT INTO school_communications
         (id, user_id, child_id, occurred_at, comm_type, subject, description, attendees, follow_up_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.childId,
        input.occurredAt,
        input.commType,
        input.subject,
        input.description ?? null,
        input.attendees ?? null,
        input.followUpDate ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToLog(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<SchoolCommunication | null> {
    const result = await pool.query(
      `SELECT * FROM school_communications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToLog(result.rows[0]);
  }

  async findAllByUser(
    userId: string,
    filters: SchoolCommunicationFilters,
  ): Promise<{ data: SchoolCommunicationSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.childId) {
      params.push(filters.childId);
      conditions.push(`child_id = $${params.length}`);
    }
    if (filters.commType) {
      params.push(filters.commType);
      conditions.push(`comm_type = $${params.length}`);
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
      `SELECT COUNT(*) FROM school_communications WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, child_id, occurred_at, comm_type, subject, attendees, follow_up_date, created_at
       FROM school_communications
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

  async update(
    id: string,
    userId: string,
    input: SchoolCommunicationUpdateInput,
  ): Promise<SchoolCommunication | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (input.occurredAt !== undefined) {
      params.push(input.occurredAt);
      setClauses.push(`occurred_at = $${params.length}`);
    }
    if (input.commType !== undefined) {
      params.push(input.commType);
      setClauses.push(`comm_type = $${params.length}`);
    }
    if (input.subject !== undefined) {
      params.push(input.subject);
      setClauses.push(`subject = $${params.length}`);
    }
    if ('description' in input) {
      params.push(input.description ?? null);
      setClauses.push(`description = $${params.length}`);
    }
    if ('attendees' in input) {
      params.push(input.attendees ?? null);
      setClauses.push(`attendees = $${params.length}`);
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
      `UPDATE school_communications
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToLog(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM school_communications WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
