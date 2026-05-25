import pool from '../database/connection';
import { Therapist, TherapistProps, TherapyType } from '../../domain/entities/Therapist';
import {
  TherapistRepository,
  TherapistCreateInput,
  TherapistUpdateInput,
} from '../../domain/repositories/TherapistRepository';

export class PgTherapistRepository implements TherapistRepository {
  private mapRowToTherapist(row: Record<string, unknown>): Therapist {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      specialty: row.specialty as TherapyType,
      phone: row.phone as string | null,
      email: row.email as string | null,
      notes: row.notes as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies TherapistProps;
    return new Therapist(props);
  }

  async save(input: TherapistCreateInput): Promise<Therapist> {
    const result = await pool.query(
      `INSERT INTO therapists (id, user_id, name, specialty, phone, email, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.userId,
        input.name,
        input.specialty,
        input.phone ?? null,
        input.email ?? null,
        input.notes ?? null,
      ],
    );
    return this.mapRowToTherapist(result.rows[0]);
  }

  async findById(id: string, userId: string): Promise<Therapist | null> {
    const result = await pool.query(
      `SELECT * FROM therapists WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows.length === 0 ? null : this.mapRowToTherapist(result.rows[0]);
  }

  async findAllByUser(userId: string): Promise<Therapist[]> {
    const result = await pool.query(
      `SELECT * FROM therapists WHERE user_id = $1 ORDER BY name ASC`,
      [userId],
    );
    return result.rows.map((row) => this.mapRowToTherapist(row));
  }

  async update(id: string, userId: string, input: TherapistUpdateInput): Promise<Therapist | null> {
    const params: unknown[] = [];
    const setClauses: string[] = [];

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (input.specialty !== undefined) {
      params.push(input.specialty);
      setClauses.push(`specialty = $${params.length}`);
    }
    if ('phone' in input) {
      params.push(input.phone ?? null);
      setClauses.push(`phone = $${params.length}`);
    }
    if ('email' in input) {
      params.push(input.email ?? null);
      setClauses.push(`email = $${params.length}`);
    }
    if ('notes' in input) {
      params.push(input.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }

    if (setClauses.length === 0) return this.findById(id, userId);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const result = await pool.query(
      `UPDATE therapists
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    return result.rows.length === 0 ? null : this.mapRowToTherapist(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM therapists WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
