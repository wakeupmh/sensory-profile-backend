import { Clinic } from '../entities/Clinic';
import { ClinicMember, ClinicRole } from '../entities/ClinicMember';

export interface ClinicCreateInput {
  id: string;
  name: string;
  createdByUserId: string;
}

export interface ClinicMemberCreateInput {
  id: string;
  clinicId: string;
  memberName: string;
  role: ClinicRole;
  invitedByUserId: string;
  /** Nulos quando a pessoa já entra dentro (o criador da clínica). */
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  memberUserId?: string | null;
}

/** Uma clínica de que eu faço parte, com o meu papel nela. */
export interface ClinicMembershipEntry {
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  acceptedAt: Date | null;
}

/** Uma linha do quadro. `caseloadSize` é número, nunca identidade. */
export interface ClinicRosterEntry {
  member: ClinicMember;
  caseloadSize: number;
}

export interface ClinicRepository {
  createClinic(input: ClinicCreateInput): Promise<Clinic>;
  addMember(input: ClinicMemberCreateInput): Promise<ClinicMember>;
  findMembership(clinicId: string, userId: string): Promise<ClinicMember | null>;
  listMemberships(userId: string): Promise<ClinicMembershipEntry[]>;
  listRoster(clinicId: string): Promise<ClinicRosterEntry[]>;
  findByInvitationToken(token: string): Promise<ClinicMember | null>;
  acceptInvitation(id: string, acceptingUserId: string): Promise<ClinicMember | null>;
  revokeMember(id: string, clinicId: string): Promise<boolean>;
}
