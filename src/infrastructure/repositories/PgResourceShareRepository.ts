import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import {
  ResourceShareRepository,
  ShareGrant,
  SharedResourceSummary,
} from '../../domain/repositories/ResourceShareRepository';

interface ShareTableConfig {
  table: 'anamnese_shares' | 'assessment_shares';
  resourceColumn: 'anamnese_id' | 'assessment_id';
}

class PgResourceShareRepositoryBase implements ResourceShareRepository {
  constructor(private readonly cfg: ShareTableConfig) {}

  async grant(
    resourceId: string,
    professionalId: string,
    grantedByUserId: string
  ): Promise<ShareGrant> {
    const id = uuidv7();
    const result = await pool.query(
      `INSERT INTO ${this.cfg.table}
         (id, ${this.cfg.resourceColumn}, professional_id, granted_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (${this.cfg.resourceColumn}, professional_id) DO UPDATE
         SET granted_by_user_id = EXCLUDED.granted_by_user_id
       RETURNING *`,
      [id, resourceId, professionalId, grantedByUserId]
    );

    const row = result.rows[0];
    const grants = await this.listForResource(resourceId);
    const enriched = grants.find((g) => g.professionalId === professionalId);
    if (enriched) return enriched;

    // Fallback (shouldn't happen — INSERT just succeeded)
    return {
      id: row.id as string,
      resourceId,
      professionalId,
      professionalName: '',
      professionalEmail: null,
      professionalProfession: null,
      professionalStatus: 'pending',
      grantedByUserId: row.granted_by_user_id as string,
      createdAt: row.created_at as Date,
    };
  }

  async revoke(resourceId: string, professionalId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${this.cfg.table}
       WHERE ${this.cfg.resourceColumn} = $1 AND professional_id = $2`,
      [resourceId, professionalId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForResource(resourceId: string): Promise<ShareGrant[]> {
    const result = await pool.query(
      `SELECT s.id, s.${this.cfg.resourceColumn} AS resource_id,
              s.professional_id, s.granted_by_user_id, s.created_at,
              p.name AS professional_name,
              p.email AS professional_email,
              p.profession AS professional_profession,
              CASE WHEN p.accepted_user_id IS NULL THEN 'pending'
                   ELSE 'accepted' END AS professional_status
       FROM ${this.cfg.table} s
       JOIN professionals p ON p.id = s.professional_id
       WHERE s.${this.cfg.resourceColumn} = $1
       ORDER BY s.created_at ASC`,
      [resourceId]
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      resourceId: row.resource_id as string,
      professionalId: row.professional_id as string,
      professionalName: row.professional_name as string,
      professionalEmail: (row.professional_email as string | null) ?? null,
      professionalProfession: (row.professional_profession as string | null) ?? null,
      professionalStatus: row.professional_status as 'pending' | 'accepted',
      grantedByUserId: row.granted_by_user_id as string,
      createdAt: row.created_at as Date,
    }));
  }

  async listForProfessionalIds(professionalIds: string[]): Promise<SharedResourceSummary[]> {
    if (professionalIds.length === 0) return [];
    const result = await pool.query(
      `SELECT s.${this.cfg.resourceColumn} AS resource_id,
              s.professional_id,
              s.granted_by_user_id AS owner_user_id,
              s.created_at
       FROM ${this.cfg.table} s
       WHERE s.professional_id = ANY($1::uuid[])
       ORDER BY s.created_at DESC`,
      [professionalIds]
    );
    return result.rows.map((row) => ({
      resourceId: row.resource_id as string,
      professionalId: row.professional_id as string,
      ownerUserId: row.owner_user_id as string,
      sharedAt: row.created_at as Date,
    }));
  }

  async hasAccess(resourceId: string, professionalIds: string[]): Promise<boolean> {
    if (professionalIds.length === 0) return false;
    const result = await pool.query(
      `SELECT 1 FROM ${this.cfg.table}
       WHERE ${this.cfg.resourceColumn} = $1
         AND professional_id = ANY($2::uuid[])
       LIMIT 1`,
      [resourceId, professionalIds]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export class PgAnamneseShareRepository extends PgResourceShareRepositoryBase {
  constructor() {
    super({ table: 'anamnese_shares', resourceColumn: 'anamnese_id' });
  }
}

export class PgAssessmentShareRepository extends PgResourceShareRepositoryBase {
  constructor() {
    super({ table: 'assessment_shares', resourceColumn: 'assessment_id' });
  }
}
