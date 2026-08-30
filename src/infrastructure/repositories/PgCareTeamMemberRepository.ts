import pool from '../database/connection';
import { CareTeamMember, CareTeamMemberProps, CareTeamRole } from '../../domain/entities/CareTeamMember';
import {
  CareTeamMemberRepository,
  CareTeamMemberCreateInput,
  CareTeamCaseloadEntry,
} from '../../domain/repositories/CareTeamMemberRepository';

/** SQLSTATE de violação de unicidade (índice parcial de participação viva). */
const UNIQUE_VIOLATION = '23505';

function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export class PgCareTeamMemberRepository implements CareTeamMemberRepository {
  private mapRow(row: Record<string, unknown>): CareTeamMember {
    const props = {
      id: row.id as string,
      childId: row.child_id as string,
      memberUserId: (row.member_user_id as string | null) ?? null,
      memberName: row.member_name as string,
      role: row.role as CareTeamRole,
      grantedByUserId: row.granted_by_user_id as string,
      invitationToken: (row.invitation_token as string | null) ?? null,
      invitationExpiresAt: (row.invitation_expires_at as Date | null) ?? null,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
      revokedAt: (row.revoked_at as Date | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    } satisfies CareTeamMemberProps;
    return new CareTeamMember(props);
  }

  async save(input: CareTeamMemberCreateInput): Promise<CareTeamMember> {
    const result = await pool.query(
      `INSERT INTO care_team_members
         (id, child_id, granted_by_user_id, member_name, role, invitation_token, invitation_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.childId,
        input.grantedByUserId,
        input.memberName,
        input.role,
        input.invitationToken,
        input.invitationExpiresAt,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByInvitationToken(token: string): Promise<CareTeamMember | null> {
    const result = await pool.query(
      `SELECT * FROM care_team_members
       WHERE invitation_token = $1
         AND member_user_id IS NULL
         AND revoked_at IS NULL
         AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)`,
      [token],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async acceptInvitation(id: string, memberUserId: string): Promise<CareTeamMember | null> {
    // UPDATE condicional: as mesmas condições da busca voltam aqui, dentro da
    // própria escrita. Entre ler o convite e gravá-lo o mundo muda — outra
    // requisição aceita, o responsável revoga, a validade vence — e só o
    // `WHERE` do UPDATE decide isso sem janela. Zero linhas afetadas é a
    // resposta "não deu", indistinguível de todas as outras para quem chamou.
    try {
      const result = await pool.query(
        `UPDATE care_team_members SET
           member_user_id        = $1,
           accepted_at           = CURRENT_TIMESTAMP,
           invitation_token      = NULL,
           invitation_expires_at = NULL,
           updated_at            = CURRENT_TIMESTAMP
         WHERE id = $2
           AND member_user_id IS NULL
           AND revoked_at IS NULL
           AND (invitation_expires_at IS NULL OR invitation_expires_at > CURRENT_TIMESTAMP)
         RETURNING *`,
        [memberUserId, id],
      );
      return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
    } catch (error) {
      // Já existe participação viva desta pessoa nesta criança (índice parcial
      // único). Vira null como qualquer outra falha de aceite: um 409 aqui
      // diria a um desconhecido que aquela conta já está na equipe.
      if (pgErrorCode(error) === UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  async revoke(id: string, childId: string, grantedByUserId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE care_team_members SET
         revoked_at            = CURRENT_TIMESTAMP,
         invitation_token      = NULL,
         invitation_expires_at = NULL,
         updated_at            = CURRENT_TIMESTAMP
       WHERE id = $1
         AND child_id = $2
         AND granted_by_user_id = $3
         AND revoked_at IS NULL`,
      [id, childId, grantedByUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listForChild(childId: string, grantedByUserId: string): Promise<CareTeamMember[]> {
    const result = await pool.query(
      `SELECT * FROM care_team_members
       WHERE child_id = $1 AND granted_by_user_id = $2
       ORDER BY created_at ASC`,
      [childId, grantedByUserId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async listCaseload(memberUserId: string): Promise<CareTeamCaseloadEntry[]> {
    const result = await pool.query(
      `SELECT ctm.id            AS membership_id,
              ctm.child_id      AS child_id,
              ctm.role          AS role,
              ctm.accepted_at   AS accepted_at,
              c.name            AS child_name,
              c.birth_date::text AS child_birth_date
       FROM care_team_members ctm
       JOIN children c ON c.id = ctm.child_id
       WHERE ctm.member_user_id = $1
         AND ctm.revoked_at IS NULL
         AND ctm.accepted_at IS NOT NULL
       ORDER BY c.name ASC, ctm.accepted_at ASC`,
      [memberUserId],
    );
    return result.rows.map((row) => ({
      membershipId: row.membership_id as string,
      childId: row.child_id as string,
      childName: row.child_name as string,
      childBirthDate: (row.child_birth_date as string | null) ?? null,
      role: row.role as CareTeamRole,
      acceptedAt: (row.accepted_at as Date | null) ?? null,
    }));
  }
}
