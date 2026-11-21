import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { Pool } from 'pg';

import { CareTeamMember, CareTeamRole } from '../../domain/entities/CareTeamMember';
import {
  CareTeamMemberRepository,
  CareTeamCaseloadEntry,
} from '../../domain/repositories/CareTeamMemberRepository';
import { NotFoundError, InvitationInvalidError } from '../../infrastructure/utils/errors/CustomErrors';
import { assertChildOwned } from './childAccess';

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export interface InviteCareTeamMemberInput {
  memberName: string;
  role: CareTeamRole;
}

/**
 * Ciclo de vida do convite de um profissional para a equipe de cuidado de uma
 * criança. Segue o mesmo desenho de `CaregiverShareService` e
 * `ProfessionalService`: token de uso único, validade de 14 dias, aceite feito
 * já autenticado e um erro deliberadamente igual para toda falha de aceite.
 *
 * A diferença que justifica esta classe está em `listMyChildren`: a concessão
 * é endereçada ao `sub` do profissional, então uma conta só enxerga o conjunto
 * de crianças que lhe foi concedido — o que nenhum dos dois outros fluxos
 * oferece hoje.
 */
export class CareTeamService {
  constructor(
    private readonly repo: CareTeamMemberRepository,
    private readonly pool: Pool,
  ) {}


  async invite(
    childId: string,
    input: InviteCareTeamMemberInput,
    ownerUserId: string,
  ): Promise<CareTeamMember> {
    await assertChildOwned(this.pool, childId, ownerUserId);
    return this.repo.save({
      id: uuidv7(),
      childId,
      grantedByUserId: ownerUserId,
      memberName: input.memberName,
      role: input.role,
      invitationToken: generateToken(),
      invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });
  }

  async listForChild(childId: string, ownerUserId: string): Promise<CareTeamMember[]> {
    await assertChildOwned(this.pool, childId, ownerUserId);
    return this.repo.listForChild(childId, ownerUserId);
  }

  /**
   * Revogação SOFT. A linha fica, com `revoked_at` preenchido — apagá-la
   * apagaria a única evidência de quando o acesso existiu e quando terminou.
   */
  async revoke(id: string, childId: string, ownerUserId: string): Promise<void> {
    const ok = await this.repo.revoke(id, childId, ownerUserId);
    if (!ok) throw new NotFoundError('Participação na equipe de cuidado', id);
  }

  async acceptInvitation(token: string, acceptingUserId: string): Promise<CareTeamMember> {
    // Toda falha — token desconhecido, expirado, revogado, autoaceite, corrida
    // perdida, participação já existente — devolve a MESMA mensagem. Distinguir
    // os casos entregaria a um desconhecido um oráculo para descobrir quais
    // tokens existem. Mesmo desenho de CaregiverShareService.acceptInvitation.
    const pending = await this.repo.findByInvitationToken(token);
    if (!pending) throw new InvitationInvalidError();
    // Autoaceite: o responsável não vira profissional da própria criança.
    if (pending.getGrantedByUserId() === acceptingUserId) throw new InvitationInvalidError();

    const accepted = await this.repo.acceptInvitation(pending.getId(), acceptingUserId);
    if (!accepted) throw new InvitationInvalidError();
    return accepted;
  }

  /** O caseload do profissional: uma conta, várias crianças. */
  listMyChildren(memberUserId: string): Promise<CareTeamCaseloadEntry[]> {
    return this.repo.listCaseload(memberUserId);
  }
}
