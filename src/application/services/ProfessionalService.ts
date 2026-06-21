import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';

import { Professional } from '../../domain/entities/Professional';
import {
  ProfessionalRepository,
  ProfessionalUpdateInput,
} from '../../domain/repositories/ProfessionalRepository';
import {
  ProfessionalNotFoundError,
  InvitationInvalidError,
} from '../../infrastructure/utils/errors/CustomErrors';

export interface CreateProfessionalInput {
  name: string;
  email: string | null;
  profession: string | null;
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export class ProfessionalService {
  constructor(private readonly repo: ProfessionalRepository) {}

  listForOwner(ownerUserId: string): Promise<Professional[]> {
    return this.repo.findAllByOwner(ownerUserId);
  }

  async getForOwner(id: string, ownerUserId: string): Promise<Professional> {
    const p = await this.repo.findByIdForOwner(id, ownerUserId);
    if (!p) throw new ProfessionalNotFoundError(id);
    return p;
  }

  create(input: CreateProfessionalInput, ownerUserId: string): Promise<Professional> {
    return this.repo.save({
      id: uuidv7(),
      ownerUserId,
      name: input.name,
      email: input.email,
      profession: input.profession,
      invitationToken: generateToken(),
    });
  }

  async update(id: string, input: ProfessionalUpdateInput, ownerUserId: string): Promise<Professional> {
    const updated = await this.repo.update(id, ownerUserId, input);
    if (!updated) throw new ProfessionalNotFoundError(id);
    return updated;
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    const ok = await this.repo.delete(id, ownerUserId);
    if (!ok) throw new ProfessionalNotFoundError(id);
  }

  async rotateInvitation(id: string, ownerUserId: string): Promise<Professional> {
    const existing = await this.repo.findByIdForOwner(id, ownerUserId);
    if (!existing) throw new ProfessionalNotFoundError(id);
    if (existing.acceptedUserId) {
      throw new InvitationInvalidError('Cannot rotate token: invitation already accepted');
    }
    const updated = await this.repo.rotateInvitationToken(id, ownerUserId, generateToken());
    if (!updated) throw new ProfessionalNotFoundError(id);
    return updated;
  }

  async acceptInvitation(token: string, acceptingUserId: string): Promise<Professional> {
    const pending = await this.repo.findByInvitationToken(token);
    if (!pending) throw new InvitationInvalidError();
    if (pending.acceptedUserId) throw new InvitationInvalidError();
    if (pending.ownerUserId === acceptingUserId) {
      throw new InvitationInvalidError('You cannot accept your own invitation');
    }

    const accepted = await this.repo.acceptInvitation(pending.id, acceptingUserId);
    if (!accepted) throw new InvitationInvalidError();
    return accepted;
  }

  listMyProfessionalIdentities(acceptedUserId: string): Promise<Professional[]> {
    return this.repo.findAllByAcceptedUser(acceptedUserId);
  }
}
