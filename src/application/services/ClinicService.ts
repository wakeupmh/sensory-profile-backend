import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { Clinic } from '../../domain/entities/Clinic';
import { ClinicMember, ClinicRole } from '../../domain/entities/ClinicMember';
import {
  ClinicRepository,
  ClinicMembershipEntry,
  ClinicRosterEntry,
} from '../../domain/repositories/ClinicRepository';
import { AuthorizationError, InvitationInvalidError } from '../../infrastructure/utils/errors/CustomErrors';

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export interface InviteClinicMemberInput {
  memberName: string;
  role: ClinicRole;
}

/**
 * A clínica administra PESSOAS, nunca dado de criança.
 *
 * Não existe método aqui que devolva registro clínico, nome de criança ou
 * qualquer coisa derivada deles. Um admin vê o quadro e o TAMANHO do caseload
 * de cada profissional; para ver o dado de uma criança ele precisa que o
 * responsável daquela criança o convide para a equipe de cuidado, como
 * qualquer outra pessoa. Ser admin não encurta esse caminho.
 */
export class ClinicService {
  constructor(private readonly repo: ClinicRepository) {}

  /** Quem cria já entra como admin aceito — senão a clínica nasce sem dono. */
  async create(name: string, creatorUserId: string): Promise<Clinic> {
    const clinic = await this.repo.createClinic({
      id: uuidv7(),
      name,
      createdByUserId: creatorUserId,
    });
    await this.repo.addMember({
      id: uuidv7(),
      clinicId: clinic.getId(),
      memberName: name,
      role: 'admin',
      invitedByUserId: creatorUserId,
      invitationToken: null,
      invitationExpiresAt: null,
      memberUserId: creatorUserId,
    });
    return clinic;
  }

  listMine(userId: string): Promise<ClinicMembershipEntry[]> {
    return this.repo.listMemberships(userId);
  }

  /**
   * Só admin ATIVO administra. Ler `clinic_members` a cada ação, em vez de
   * confiar em `clinics.created_by_user_id`, é o que faz a saída de um admin
   * valer na hora.
   */
  private async assertAdmin(clinicId: string, userId: string): Promise<void> {
    const membership = await this.repo.findMembership(clinicId, userId);
    if (!membership || !membership.isAdmin()) {
      // Mesma resposta para "não é admin" e "não faz parte": quem não
      // administra a clínica não descobre por aqui que ela existe.
      throw new AuthorizationError('Sem permissão para administrar esta clínica');
    }
  }

  async invite(clinicId: string, input: InviteClinicMemberInput, adminUserId: string): Promise<ClinicMember> {
    await this.assertAdmin(clinicId, adminUserId);
    return this.repo.addMember({
      id: uuidv7(),
      clinicId,
      memberName: input.memberName,
      role: input.role,
      invitedByUserId: adminUserId,
      invitationToken: generateToken(),
      invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });
  }

  async listRoster(clinicId: string, adminUserId: string): Promise<ClinicRosterEntry[]> {
    await this.assertAdmin(clinicId, adminUserId);
    return this.repo.listRoster(clinicId);
  }

  async revokeMember(id: string, clinicId: string, adminUserId: string): Promise<void> {
    await this.assertAdmin(clinicId, adminUserId);
    await this.repo.revokeMember(id, clinicId);
  }

  /**
   * Toda falha devolve a MESMA mensagem — token desconhecido, expirado,
   * revogado, corrida perdida, já é do quadro. Distinguir os casos entregaria
   * a um desconhecido um oráculo para descobrir quais tokens existem.
   */
  async acceptInvitation(token: string, acceptingUserId: string): Promise<ClinicMember> {
    const pending = await this.repo.findByInvitationToken(token);
    if (!pending) throw new InvitationInvalidError();

    const accepted = await this.repo.acceptInvitation(pending.getId(), acceptingUserId);
    if (!accepted) throw new InvitationInvalidError();
    return accepted;
  }
}
