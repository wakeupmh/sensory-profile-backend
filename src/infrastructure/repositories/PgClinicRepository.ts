import pool from '../database/connection';
import { Clinic, ClinicProps } from '../../domain/entities/Clinic';
import { ClinicMember, ClinicMemberProps, ClinicRole } from '../../domain/entities/ClinicMember';
import {
  ClinicRepository,
  ClinicCreateInput,
  ClinicMemberCreateInput,
  ClinicMembershipEntry,
  ClinicRosterEntry,
} from '../../domain/repositories/ClinicRepository';

/** SQLSTATE de violação de unicidade (índice parcial de participação viva). */
const UNIQUE_VIOLATION = '23505';

function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export class PgClinicRepository implements ClinicRepository {
  private mapMember(row: Record<string, unknown>): ClinicMember {
    const props = {
      id: row.id as string,
      clinicId: row.clinic_id as string,
      memberUserId: (row.member_user_id as string | null) ?? null,
      memberName: row.member_name as string,
      role: row.role as ClinicRole,
      invitedByUserId: (row.invited_by_user_id as string | null) ?? null,
      invitationToken: (row.invitation_token as string | null) ?? null,
      invitationExpiresAt: (row.invitation_expires_at as Date | null) ?? null,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
      revokedAt: (row.revoked_at as Date | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies ClinicMemberProps;
    return new ClinicMember(props);
  }

  async createClinic(input: ClinicCreateInput): Promise<Clinic> {
    const result = await pool.query(
      `INSERT INTO clinics (id, name, created_by_user_id) VALUES ($1, $2, $3) RETURNING *`,
      [input.id, input.name, input.createdByUserId],
    );
    const row = result.rows[0];
    return new Clinic({
      id: row.id,
      name: row.name,
      createdByUserId: row.created_by_user_id ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    } satisfies ClinicProps);
  }

  async addMember(input: ClinicMemberCreateInput): Promise<ClinicMember> {
    const result = await pool.query(
      `INSERT INTO clinic_members
         (id, clinic_id, member_name, role, invited_by_user_id,
          invitation_token, invitation_expires_at, member_user_id, accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               CASE WHEN $8::text IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
       RETURNING *`,
      [
        input.id,
        input.clinicId,
        input.memberName,
        input.role,
        input.invitedByUserId,
        input.invitationToken,
        input.invitationExpiresAt,
        input.memberUserId ?? null,
      ],
    );
    return this.mapMember(result.rows[0]);
  }

  /** A participação VIVA de alguém numa clínica — é o que autoriza. */
  async findMembership(clinicId: string, userId: string): Promise<ClinicMember | null> {
    const result = await pool.query(
      `SELECT * FROM clinic_members
        WHERE clinic_id = $1 AND member_user_id = $2
          AND accepted_at IS NOT NULL AND revoked_at IS NULL`,
      [clinicId, userId],
    );
    return result.rows.length > 0 ? this.mapMember(result.rows[0]) : null;
  }

  async listMemberships(userId: string): Promise<ClinicMembershipEntry[]> {
    const result = await pool.query(
      `SELECT cm.clinic_id, c.name AS clinic_name, cm.role, cm.accepted_at
         FROM clinic_members cm
         JOIN clinics c ON c.id = cm.clinic_id
        WHERE cm.member_user_id = $1
          AND cm.accepted_at IS NOT NULL AND cm.revoked_at IS NULL
        ORDER BY c.name`,
      [userId],
    );
    return result.rows.map((row) => ({
      clinicId: row.clinic_id as string,
      clinicName: row.clinic_name as string,
      role: row.role as ClinicRole,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
    }));
  }

  /**
   * O quadro, com QUANTAS crianças cada profissional atende.
   *
   * A subconsulta conta e não devolve identidade nenhuma — é a fronteira desta
   * feature inteira, escrita em SQL: a clínica administra pessoas, e as
   * crianças continuam sendo do responsável que as concedeu. Bate no índice
   * parcial de `care_team_members(member_user_id)`.
   */
  async listRoster(clinicId: string): Promise<ClinicRosterEntry[]> {
    const result = await pool.query(
      `SELECT cm.*,
              COALESCE((
                SELECT COUNT(*) FROM care_team_members ctm
                 WHERE ctm.member_user_id = cm.member_user_id
                   AND ctm.accepted_at IS NOT NULL
                   AND ctm.revoked_at IS NULL
              ), 0)::int AS caseload_size
         FROM clinic_members cm
        WHERE cm.clinic_id = $1
        ORDER BY cm.revoked_at NULLS FIRST, cm.member_name`,
      [clinicId],
    );
    return result.rows.map((row) => ({
      member: this.mapMember(row),
      caseloadSize: row.caseload_size as number,
    }));
  }

  async findByInvitationToken(token: string): Promise<ClinicMember | null> {
    const result = await pool.query(
      `SELECT * FROM clinic_members
        WHERE invitation_token = $1
          AND member_user_id IS NULL
          AND revoked_at IS NULL
          AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)`,
      [token],
    );
    return result.rows.length > 0 ? this.mapMember(result.rows[0]) : null;
  }

  /**
   * Aceite condicional: as checagens vão DENTRO do UPDATE, e não antes dele,
   * para não sobrar janela entre verificar e escrever. Mesmo desenho do aceite
   * da equipe de cuidado.
   */
  async acceptInvitation(id: string, acceptingUserId: string): Promise<ClinicMember | null> {
    try {
      const result = await pool.query(
        `UPDATE clinic_members
            SET member_user_id = $2,
                accepted_at = CURRENT_TIMESTAMP,
                invitation_token = NULL,
                invitation_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND member_user_id IS NULL
            AND revoked_at IS NULL
            AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)
          RETURNING *`,
        [id, acceptingUserId],
      );
      return result.rows.length > 0 ? this.mapMember(result.rows[0]) : null;
    } catch (error) {
      // Já faz parte desta clínica. Vira o mesmo `null` de qualquer outra
      // falha para que a resposta não confirme que a conta já está lá.
      if (pgErrorCode(error) === UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  /** Saída soft: a linha fica, para a trilha saber quando entrou e saiu. */
  async revokeMember(id: string, clinicId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE clinic_members
          SET revoked_at = CURRENT_TIMESTAMP,
              invitation_token = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND clinic_id = $2 AND revoked_at IS NULL`,
      [id, clinicId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
