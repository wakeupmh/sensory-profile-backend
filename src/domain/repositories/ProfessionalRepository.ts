import { Professional } from '../entities/Professional';

export interface ProfessionalCreateInput {
  id: string;
  ownerUserId: string;
  name: string;
  email: string | null;
  profession: string | null;
  invitationToken: string;
}

export interface ProfessionalUpdateInput {
  name: string;
  email: string | null;
  profession: string | null;
}

export interface ProfessionalRepository {
  findAllByOwner(ownerUserId: string): Promise<Professional[]>;
  findByIdForOwner(id: string, ownerUserId: string): Promise<Professional | null>;
  findByInvitationToken(token: string): Promise<Professional | null>;
  findAllByAcceptedUser(acceptedUserId: string): Promise<Professional[]>;
  save(input: ProfessionalCreateInput): Promise<Professional>;
  update(id: string, ownerUserId: string, input: ProfessionalUpdateInput): Promise<Professional | null>;
  delete(id: string, ownerUserId: string): Promise<boolean>;
  acceptInvitation(id: string, acceptedUserId: string): Promise<Professional | null>;
  rotateInvitationToken(id: string, ownerUserId: string, token: string): Promise<Professional | null>;
}
