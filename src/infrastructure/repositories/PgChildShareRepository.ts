import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { ChildShareGrant, ChildShareScope, ProfessionalAccessStatus } from '../../domain/entities/ChildShare';
import { ChildShareRepository, ProfessionalChildAccess } from '../../domain/repositories/ChildShareRepository';

export class PgChildShareRepository implements ChildShareRepository {
  private mapRow(row: Record<string, unknown>): ChildShareGrant {
    return new ChildShareGrant({
      id: row.id as string,
      childId: row.child_id as string,
      professionalId: row.professional_id as string,
      professionalName: row.professional_name as string,
      professionalStatus: row.professional_status as ProfessionalAccessStatus,
      grantedByUserId: row.granted_by_user_id as string,
      scopes: (row.scopes as ChildShareScope[]) ?? [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }

  async grant(
    childId: string,
    professionalId: string,
    grantedByUserId: string,
    scopes: ChildShareScope[],
  ): Promise<ChildShareGrant> {
    await pool.query(
      `INSERT INTO child_shares (id, child_id, professional_id, granted_by_user_id, scopes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id, professional_id) DO UPDATE
         SET scopes = EXCLUDED.scopes, updated_at = CURRENT_TIMESTAMP`,
      [uuidv7(), childId, professionalId, grantedByUserId, scopes],
    );

    const grants = await this.listForChild(childId);
    const grant = grants.find((g) => g.getProfessionalId() === professionalId);
    if (!grant) throw new Error('Failed to read back child share grant after upsert');
    return grant;
  }

  async revoke(childId: string, professionalId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM child_shares WHERE child_id = $1 AND professional_id = $2`,
      [childId, professionalId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForChild(childId: string): Promise<ChildShareGrant[]> {
    const result = await pool.query(
      `SELECT cs.id, cs.child_id, cs.professional_id, cs.granted_by_user_id, cs.scopes,
              cs.created_at, cs.updated_at,
              p.name AS professional_name,
              CASE WHEN p.accepted_user_id IS NULL THEN 'pending' ELSE 'accepted' END AS professional_status
       FROM child_shares cs
       JOIN professionals p ON p.id = cs.professional_id
       WHERE cs.child_id = $1
       ORDER BY cs.created_at ASC`,
      [childId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async listForProfessionalIds(professionalIds: string[]): Promise<ProfessionalChildAccess[]> {
    if (professionalIds.length === 0) return [];
    const result = await pool.query(
      `SELECT child_id, professional_id, scopes
       FROM child_shares
       WHERE professional_id = ANY($1::uuid[])`,
      [professionalIds],
    );
    return result.rows.map((row) => ({
      childId: row.child_id as string,
      professionalId: row.professional_id as string,
      scopes: (row.scopes as ChildShareScope[]) ?? [],
    }));
  }

  async hasScope(childId: string, professionalIds: string[], scope: ChildShareScope): Promise<boolean> {
    if (professionalIds.length === 0) return false;
    const result = await pool.query(
      `SELECT 1 FROM child_shares
       WHERE child_id = $1 AND professional_id = ANY($2::uuid[]) AND $3 = ANY(scopes)
       LIMIT 1`,
      [childId, professionalIds, scope],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async hasAnyAccess(childId: string, professionalIds: string[]): Promise<boolean> {
    if (professionalIds.length === 0) return false;
    const result = await pool.query(
      `SELECT 1 FROM child_shares
       WHERE child_id = $1 AND professional_id = ANY($2::uuid[])
       LIMIT 1`,
      [childId, professionalIds],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async resolveAccessProfessionalId(childId: string, professionalIds: string[]): Promise<string | null> {
    if (professionalIds.length === 0) return null;
    const result = await pool.query(
      `SELECT professional_id FROM child_shares
       WHERE child_id = $1 AND professional_id = ANY($2::uuid[])
       LIMIT 1`,
      [childId, professionalIds],
    );
    return result.rows.length === 0 ? null : (result.rows[0].professional_id as string);
  }
}
