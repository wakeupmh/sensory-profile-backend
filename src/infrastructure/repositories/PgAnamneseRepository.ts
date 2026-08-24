import pool from '../database/connection';

/**
 * Janela de validade do link público de anamnese. Generosa porque o caso de
 * uso real é um profissional consultando ao longo de um acompanhamento, não
 * uma visita única.
 */
export function anamneseShareValidityDays(): number {
  const raw = process.env.ANAMNESE_SHARE_VALIDITY_DAYS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
}
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
import { scopedById } from './queryUtils';

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
    const scope = scopedById('anamneses', id, userId);
    const result = await pool.query(`SELECT * FROM anamneses WHERE ${scope.where}`, scope.params);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByIdAnyOwner(id: string): Promise<Anamnese | null> {
    const result = await pool.query(
      `SELECT * FROM anamneses WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * O link público não tinha prazo: `share_token` sem coluna de expiração e a
   * consulta sem nenhum predicado de tempo. Um profissional que recebesse o
   * link mantinha acesso à anamnese inteira — identificação da criança,
   * cuidador, histórico clínico — para sempre, sem autenticação. Sob a LGPD é
   * uma divulgação por prazo indeterminado.
   *
   * A validade é medida contra `shared_at`, que já existia, em vez de uma
   * coluna nova: assim vale também para os links já emitidos, que são
   * exatamente os que estão abertos há mais tempo. O dono regenera quando
   * precisar — `generateShareLink` emite um token novo se o atual venceu.
   */
  async findByShareToken(token: string): Promise<Anamnese | null> {
    const result = await pool.query(
      `SELECT * FROM anamneses
        WHERE share_token = $1
          AND shared_at IS NOT NULL
          AND shared_at > NOW() - ($2 || ' days')::interval`,
      [token, anamneseShareValidityDays()]
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
         child            = COALESCE($1::jsonb, child),
         caregiver        = COALESCE($2::jsonb, caregiver),
         clinical_history = COALESCE($3::jsonb, clinical_history),
         updated_at       = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        input.child ? JSON.stringify(input.child) : null,
        input.caregiver ? JSON.stringify(input.caregiver) : null,
        input.clinicalHistory ? JSON.stringify(input.clinicalHistory) : null,
        id,
        userId,
      ]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const scope = scopedById('anamneses', id, userId);
    const result = await pool.query(`DELETE FROM anamneses WHERE ${scope.where}`, scope.params);
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
    const scope = scopedById('anamneses', id, userId);
    const result = await pool.query(`UPDATE anamneses SET
         share_token = NULL,
         shared_at   = NULL,
         updated_at  = CURRENT_TIMESTAMP
       WHERE ${scope.where}
       RETURNING *`, scope.params);
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
