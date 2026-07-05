import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { Pool } from 'pg';
import { CaregiverShare } from '../../domain/entities/CaregiverShare';
import { CaregiverShareRepository } from '../../domain/repositories/CaregiverShareRepository';
import { NotFoundError, InvitationInvalidError } from '../../infrastructure/utils/errors/CustomErrors';

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export class CaregiverShareService {
  constructor(
    private readonly repo: CaregiverShareRepository,
    private readonly pool: Pool,
  ) {}

  private async assertChildOwnership(childId: string, ownerUserId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, ownerUserId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
  }

  async invite(childId: string, caregiverName: string, ownerUserId: string): Promise<CaregiverShare> {
    await this.assertChildOwnership(childId, ownerUserId);
    return this.repo.save({
      id: uuidv7(),
      childId,
      ownerUserId,
      caregiverName,
      invitationToken: generateToken(),
      invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });
  }

  async acceptInvitation(token: string, acceptingUserId: string): Promise<CaregiverShare> {
    // Every failure (unknown token, expired, racy double-accept) returns the
    // same generic message so a client can't probe to distinguish them —
    // mirrors ProfessionalService.acceptInvitation.
    const pending = await this.repo.findByInvitationToken(token);
    if (!pending) throw new InvitationInvalidError();
    if (pending.getOwnerUserId() === acceptingUserId) throw new InvitationInvalidError();

    const accepted = await this.repo.acceptInvitation(pending.getId(), acceptingUserId);
    if (!accepted) throw new InvitationInvalidError();
    return accepted;
  }

  async revoke(id: string, ownerUserId: string): Promise<void> {
    const ok = await this.repo.revoke(id, ownerUserId);
    if (!ok) throw new NotFoundError('Compartilhamento com cuidador', id);
  }

  async listForChild(childId: string, ownerUserId: string): Promise<CaregiverShare[]> {
    await this.assertChildOwnership(childId, ownerUserId);
    return this.repo.listForChild(childId, ownerUserId);
  }

  /**
   * The effective owner userId for `childId` as seen by `callerId`: the
   * caller themselves if they literally own the child, the resolved owner if
   * they're an accepted caregiver, or null if neither (caller has no
   * relationship to this child at all).
   */
  async resolveEffectiveOwner(childId: string, callerId: string): Promise<string | null> {
    const ownsIt = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, callerId],
    );
    if (ownsIt.rows.length > 0) return callerId;
    return this.repo.resolveOwner(childId, callerId);
  }
}
