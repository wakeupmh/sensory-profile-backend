import { CaregiverShare } from '../entities/CaregiverShare';

export interface CaregiverShareCreateInput {
  id: string;
  childId: string;
  ownerUserId: string;
  caregiverName: string;
  invitationToken: string;
  invitationExpiresAt: Date;
}

export interface CaregiverShareRepository {
  save(input: CaregiverShareCreateInput): Promise<CaregiverShare>;
  findByInvitationToken(token: string): Promise<CaregiverShare | null>;
  acceptInvitation(id: string, caregiverUserId: string): Promise<CaregiverShare | null>;
  revoke(id: string, ownerUserId: string): Promise<boolean>;
  listForChild(childId: string, ownerUserId: string): Promise<CaregiverShare[]>;
  /**
   * The child's owner, if `caregiverUserId` is an accepted caregiver for it.
   * Returns null if there's no such relationship (caller should then fall
   * back to treating them as the literal owner, or reject).
   */
  resolveOwner(childId: string, caregiverUserId: string): Promise<string | null>;
}
