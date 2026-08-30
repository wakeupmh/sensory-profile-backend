/**
 * Pertencer a uma clínica. E SÓ isso.
 *
 * Esta entidade não concede acesso a dado nenhum. O princípio da equipe de
 * cuidado continua inteiro: o dado é do responsável, e quem concede acesso é
 * ele, a um profissional com nome. Uma clínica não recebe concessão, e um
 * admin não herda o que os profissionais dele alcançam.
 *
 * O que a clínica administra são PESSOAS: quem trabalha aqui, quem entrou,
 * quem saiu. `queryUtils` e `careTeamScopeMiddleware` não conhecem esta
 * tabela, e um teste cobra que continue assim.
 */

export const CLINIC_ROLES = ['admin', 'profissional'] as const;

export type ClinicRole = (typeof CLINIC_ROLES)[number];

export type ClinicMemberStatus = 'pending' | 'accepted' | 'revoked';

export interface ClinicMemberProps {
  id: string;
  clinicId: string;
  memberUserId: string | null;
  memberName: string;
  role: ClinicRole;
  invitedByUserId: string | null;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ClinicMember {
  constructor(private readonly props: ClinicMemberProps) {}

  getId(): string { return this.props.id; }
  getClinicId(): string { return this.props.clinicId; }
  getMemberUserId(): string | null { return this.props.memberUserId; }
  getMemberName(): string { return this.props.memberName; }
  getRole(): ClinicRole { return this.props.role; }
  isAdmin(): boolean { return this.props.role === 'admin'; }
  isAccepted(): boolean { return this.props.acceptedAt !== null; }
  isRevoked(): boolean { return this.props.revokedAt !== null; }

  getStatus(): ClinicMemberStatus {
    if (this.isRevoked()) return 'revoked';
    return this.isAccepted() ? 'accepted' : 'pending';
  }

  /**
   * O quadro, para o admin. **Sem** `invitationToken`, pelo mesmo motivo da
   * equipe de cuidado: uma listagem que devolve o token de todo convite
   * pendente deixa quem a lê entrar no lugar de outra pessoa.
   *
   * `caseloadSize` é um NÚMERO, e é de propósito: quantas crianças aquele
   * profissional atende, nunca quais. O responsável convidou uma pessoa, não
   * uma organização — a clínica saber o nome da criança seria mais do que ele
   * concedeu.
   */
  toRosterView(caseloadSize: number) {
    const { invitationToken: _token, ...rest } = this.toInviteView();
    return { ...rest, caseloadSize };
  }

  toInviteView() {
    return {
      id: this.props.id,
      clinicId: this.props.clinicId,
      memberName: this.props.memberName,
      role: this.props.role,
      status: this.getStatus(),
      invitationToken: this.props.invitationToken,
      invitationExpiresAt: this.props.invitationExpiresAt,
      acceptedAt: this.props.acceptedAt,
      revokedAt: this.props.revokedAt,
      createdAt: this.props.createdAt,
    };
  }
}
