import pool from '../database/connection';
import { CaregiverShare, CaregiverShareProps } from '../../domain/entities/CaregiverShare';
import {
  CaregiverShareRepository,
  CaregiverShareCreateInput,
} from '../../domain/repositories/CaregiverShareRepository';

export class PgCaregiverShareRepository implements CaregiverShareRepository {
  private mapRow(row: Record<string, unknown>): CaregiverShare {
    const props = {
      id: row.id as string,
      childId: row.child_id as string,
      ownerUserId: row.owner_user_id as string,
      caregiverName: row.caregiver_name as string,
      caregiverUserId: (row.caregiver_user_id as string | null) ?? null,
      invitationToken: (row.invitation_token as string | null) ?? null,
      invitationExpiresAt: (row.invitation_expires_at as Date | null) ?? null,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies CaregiverShareProps;
    return new CaregiverShare(props);
  }

  async save(input: CaregiverShareCreateInput): Promise<CaregiverShare> {
    const result = await pool.query(
      `INSERT INTO caregiver_shares
         (id, child_id, owner_user_id, caregiver_name, invitation_token, invitation_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.id, input.childId, input.ownerUserId, input.caregiverName, input.invitationToken, input.invitationExpiresAt],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByInvitationToken(token: string): Promise<CaregiverShare | null> {
    const result = await pool.query(
      `SELECT * FROM caregiver_shares
       WHERE invitation_token = $1
         AND caregiver_user_id IS NULL
         AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)`,
      [token],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async acceptInvitation(id: string, caregiverUserId: string): Promise<CaregiverShare | null> {
    const result = await pool.query(
      `UPDATE caregiver_shares SET
         caregiver_user_id     = $1,
         accepted_at           = CURRENT_TIMESTAMP,
         invitation_token      = NULL,
         invitation_expires_at = NULL,
         updated_at            = CURRENT_TIMESTAMP
       WHERE id = $2 AND caregiver_user_id IS NULL
       RETURNING *`,
      [caregiverUserId, id],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async revoke(id: string, ownerUserId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM caregiver_shares WHERE id = $1 AND owner_user_id = $2`,
      [id, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForChild(childId: string, ownerUserId: string): Promise<CaregiverShare[]> {
    const result = await pool.query(
      `SELECT * FROM caregiver_shares WHERE child_id = $1 AND owner_user_id = $2 ORDER BY created_at ASC`,
      [childId, ownerUserId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async resolveOwner(childId: string, caregiverUserId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT owner_user_id FROM caregiver_shares
       WHERE child_id = $1 AND caregiver_user_id = $2
       LIMIT 1`,
      [childId, caregiverUserId],
    );
    return result.rows.length === 0 ? null : (result.rows[0].owner_user_id as string);
  }
}
