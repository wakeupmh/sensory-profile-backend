import { CareTeamMember, CareTeamRole } from '../entities/CareTeamMember';

export interface CareTeamMemberCreateInput {
  id: string;
  childId: string;
  /** Sempre o dono da criança — ver CONTRACT.md. */
  grantedByUserId: string;
  memberName: string;
  role: CareTeamRole;
  invitationToken: string;
  invitationExpiresAt: Date;
}

/**
 * Uma criança do caseload do profissional. Traz o mínimo para montar a lista
 * de atendimentos: nada do dono (nem o `sub` dele) atravessa para cá — o
 * profissional recebeu acesso à criança, não à conta do responsável.
 */
export interface CareTeamCaseloadEntry {
  membershipId: string;
  childId: string;
  childName: string;
  childBirthDate: string | null;
  role: CareTeamRole;
  acceptedAt: Date | null;
}

export interface CareTeamMemberRepository {
  save(input: CareTeamMemberCreateInput): Promise<CareTeamMember>;

  /** Só convites vivos: não aceito, não revogado e dentro da validade. */
  findByInvitationToken(token: string): Promise<CareTeamMember | null>;

  /**
   * Aceite condicional: devolve null quando outra requisição já aceitou, o
   * convite expirou ou foi revogado no meio do caminho, e também quando o
   * aceitante já tem participação viva nesta criança.
   */
  acceptInvitation(id: string, memberUserId: string): Promise<CareTeamMember | null>;

  /**
   * Revogação SOFT: marca `revoked_at` e preserva a linha. `childId` entra na
   * condição junto do dono para que um id de participação de outra criança do
   * mesmo responsável não seja alcançável por esta rota.
   */
  revoke(id: string, childId: string, grantedByUserId: string): Promise<boolean>;

  listForChild(childId: string, grantedByUserId: string): Promise<CareTeamMember[]>;

  /** As crianças com participação aceita e não revogada deste profissional. */
  listCaseload(memberUserId: string): Promise<CareTeamCaseloadEntry[]>;
}
