import pool from '../database/connection';
import {
  Anamnese,
  AnamneseChild,
  AnamneseCaregiver,
  AnamneseClinicalHistory,
  AnamneseSummary,
} from '../../domain/entities/Anamnese';
import {
  AnamneseRepository,
  AnamneseCreateInput,
  AnamneseUpdateInput,
} from '../../domain/repositories/AnamneseRepository';

export class PgAnamneseRepository implements AnamneseRepository {
  async findAllByUser(userId: string): Promise<AnamneseSummary[]> {
    const result = await pool.query(
      `SELECT
         id,
         child->>'name'     AS child_name,
         caregiver->>'name' AS caregiver_name,
         share_token,
         created_at,
         updated_at
       FROM anamneses
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id as string,
      childName: (row.child_name as string) ?? '',
      caregiverName: (row.caregiver_name as string) ?? '',
      shareToken: (row.share_token as string | null) ?? null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));
  }

  async findById(id: string, userId: string): Promise<Anamnese | null> {
    const result = await pool.query(
      `SELECT * FROM anamneses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByShareToken(token: string): Promise<Anamnese | null> {
    const result = await pool.query(
      `SELECT * FROM anamneses WHERE share_token = $1`,
      [token]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async save(input: AnamneseCreateInput): Promise<Anamnese> {
    const result = await pool.query(
      `INSERT INTO anamneses (id, user_id, child, caregiver, clinical_history)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       RETURNING *`,
      [
        input.id,
        input.userId,
        JSON.stringify(input.child),
        JSON.stringify(input.caregiver),
        JSON.stringify(input.clinicalHistory),
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    userId: string,
    input: AnamneseUpdateInput
  ): Promise<Anamnese | null> {
    const result = await pool.query(
      `UPDATE anamneses SET
         child            = $1::jsonb,
         caregiver        = $2::jsonb,
         clinical_history = $3::jsonb,
         updated_at       = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        JSON.stringify(input.child),
        JSON.stringify(input.caregiver),
        JSON.stringify(input.clinicalHistory),
        id,
        userId,
      ]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM anamneses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async setShareToken(
    id: string,
    userId: string,
    token: string
  ): Promise<Anamnese | null> {
    const result = await pool.query(
      `UPDATE anamneses SET
         share_token = $1,
         shared_at   = CURRENT_TIMESTAMP,
         updated_at  = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [token, id, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async clearShareToken(id: string, userId: string): Promise<Anamnese | null> {
    const result = await pool.query(
      `UPDATE anamneses SET
         share_token = NULL,
         shared_at   = NULL,
         updated_at  = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Anamnese {
    return new Anamnese({
      id: row.id as string,
      userId: row.user_id as string,
      child: row.child as AnamneseChild,
      caregiver: row.caregiver as AnamneseCaregiver,
      clinicalHistory: row.clinical_history as AnamneseClinicalHistory,
      shareToken: (row.share_token as string | null) ?? null,
      sharedAt: (row.shared_at as Date | null) ?? null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }
}
