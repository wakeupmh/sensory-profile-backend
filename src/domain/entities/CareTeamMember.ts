/**
 * Participação de um profissional na equipe de cuidado de uma criança.
 *
 * O acesso é sempre CONCEDIDO pelo responsável (`grantedByUserId` é o dono da
 * criança) e endereçado ao `sub` de quem aceita (`memberUserId`), o que
 * permite que uma única conta de profissional atenda várias crianças.
 */

export const CARE_TEAM_ROLES = [
  'fonoaudiologia',
  'psicologia',
  'terapia_ocupacional',
  'acompanhante_terapeutico',
  'educacao_fisica',
  'fisioterapia',
  'psicopedagogia',
  'outro',
] as const;

export type CareTeamRole = (typeof CARE_TEAM_ROLES)[number];

export type CareTeamMemberStatus = 'pending' | 'accepted' | 'revoked';

export interface CareTeamMemberProps {
  id: string;
  childId: string;
  memberUserId: string | null;
  memberName: string;
  role: CareTeamRole;
  grantedByUserId: string;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CareTeamMember {
  constructor(private readonly props: CareTeamMemberProps) {}

  getId(): string { return this.props.id; }
  getChildId(): string { return this.props.childId; }
  getGrantedByUserId(): string { return this.props.grantedByUserId; }
  getMemberUserId(): string | null { return this.props.memberUserId; }
  getRole(): CareTeamRole { return this.props.role; }
  isAccepted(): boolean { return this.props.acceptedAt !== null; }
  isRevoked(): boolean { return this.props.revokedAt !== null; }

  getStatus(): CareTeamMemberStatus {
    if (this.isRevoked()) return 'revoked';
    return this.isAccepted() ? 'accepted' : 'pending';
  }

  /**
   * Listagem para o responsável. **Sem** `invitationToken`: uma listagem que
   * devolve o token de todo convite pendente deixa quem a lê aceitar um
   * convite endereçado a outra pessoa. O token só aparece na resposta da
   * criação, uma única vez, para o responsável repassá-lo a quem convidou.
   * Mesmo raciocínio de `CaregiverShare.toListView`.
   */
  toListView() {
    const { invitationToken: _token, ...rest } = this.toOwnerView();
    return rest;
  }

  toOwnerView() {
    return {
      id: this.props.id,
      childId: this.props.childId,
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
