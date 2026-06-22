import pool from '../database/connection';
import { Professional } from '../../domain/entities/Professional';
import {
  ProfessionalRepository,
  ProfessionalCreateInput,
  ProfessionalUpdateInput,
} from '../../domain/repositories/ProfessionalRepository';

export class PgProfessionalRepository implements ProfessionalRepository {
  async findAllByOwner(ownerUserId: string): Promise<Professional[]> {
    const result = await pool.query(
      `SELECT * FROM professionals
       WHERE owner_user_id = $1
       ORDER BY created_at DESC`,
      [ownerUserId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByIdForOwner(id: string, ownerUserId: string): Promise<Professional | null> {
    const result = await pool.query(
      `SELECT * FROM professionals WHERE id = $1 AND owner_user_id = $2`,
      [id, ownerUserId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByInvitationToken(token: string): Promise<Professional | null> {
    const result = await pool.query(
      `SELECT * FROM professionals
       WHERE invitation_token = $1
         AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAllByAcceptedUser(acceptedUserId: string): Promise<Professional[]> {
    const result = await pool.query(
      `SELECT * FROM professionals
       WHERE accepted_user_id = $1
       ORDER BY created_at DESC`,
      [acceptedUserId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async save(input: ProfessionalCreateInput): Promise<Professional> {
    const result = await pool.query(
      `INSERT INTO professionals
         (id, owner_user_id, name, email, profession, invitation_token, invitation_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.ownerUserId,
        input.name,
        input.email,
        input.profession,
        input.invitationToken,
        input.invitationExpiresAt,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    ownerUserId: string,
    input: ProfessionalUpdateInput
  ): Promise<Professional | null> {
    const result = await pool.query(
      `UPDATE professionals SET
         name       = $1,
         email      = $2,
         profession = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND owner_user_id = $5
       RETURNING *`,
      [input.name, input.email, input.profession, id, ownerUserId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string, ownerUserId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM professionals WHERE id = $1 AND owner_user_id = $2`,
      [id, ownerUserId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async acceptInvitation(id: string, acceptedUserId: string): Promise<Professional | null> {
    const result = await pool.query(
      `UPDATE professionals SET
         accepted_user_id      = $1,
         accepted_at           = CURRENT_TIMESTAMP,
         invitation_token      = NULL,
         invitation_expires_at = NULL,
         updated_at            = CURRENT_TIMESTAMP
       WHERE id = $2
         AND accepted_user_id IS NULL
         AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)
       RETURNING *`,
      [acceptedUserId, id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async rotateInvitationToken(
    id: string,
    ownerUserId: string,
    token: string,
    expiresAt: Date
  ): Promise<Professional | null> {
    const result = await pool.query(
      `UPDATE professionals SET
         invitation_token      = $1,
         invitation_expires_at = $2,
         updated_at            = CURRENT_TIMESTAMP
       WHERE id = $3 AND owner_user_id = $4 AND accepted_user_id IS NULL
       RETURNING *`,
      [token, expiresAt, id, ownerUserId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Professional {
    return new Professional({
      id: row.id as string,
      ownerUserId: row.owner_user_id as string,
      name: row.name as string,
      email: (row.email as string | null) ?? null,
      profession: (row.profession as string | null) ?? null,
      invitationToken: (row.invitation_token as string | null) ?? null,
      invitationExpiresAt: (row.invitation_expires_at as Date | null) ?? null,
      acceptedUserId: (row.accepted_user_id as string | null) ?? null,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }
}
