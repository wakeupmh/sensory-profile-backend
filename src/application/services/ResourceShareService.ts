import {
  ResourceShareRepository,
  ShareGrant,
  SharedResourceSummary,
} from '../../domain/repositories/ResourceShareRepository';
import { ProfessionalRepository } from '../../domain/repositories/ProfessionalRepository';
import {
  ProfessionalNotFoundError,
  NotFoundError,
} from '../../infrastructure/utils/errors/CustomErrors';

export interface ResourceOwnershipCheck {
  /** Throws (or returns false) if `resourceId` is not owned by `ownerUserId`. */
  assertOwned(resourceId: string, ownerUserId: string): Promise<void>;
  resourceLabel: string;
}

export class ResourceShareService {
  constructor(
    private readonly shareRepo: ResourceShareRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly ownership: ResourceOwnershipCheck
  ) {}

  /** Owner-side: grant access to a professional. Idempotent. */
  async grant(
    resourceId: string,
    professionalId: string,
    ownerUserId: string
  ): Promise<ShareGrant> {
    await this.ownership.assertOwned(resourceId, ownerUserId);

    const prof = await this.professionalRepo.findByIdForOwner(professionalId, ownerUserId);
    if (!prof) throw new ProfessionalNotFoundError(professionalId);

    return this.shareRepo.grant(resourceId, professionalId, ownerUserId);
  }

  /** Owner-side: revoke. */
  async revoke(
    resourceId: string,
    professionalId: string,
    ownerUserId: string
  ): Promise<void> {
    await this.ownership.assertOwned(resourceId, ownerUserId);
    const ok = await this.shareRepo.revoke(resourceId, professionalId);
    if (!ok) {
      throw new NotFoundError(
        `Share for ${this.ownership.resourceLabel}`,
        `${resourceId}/${professionalId}`
      );
    }
  }

  /** Owner-side: list grants for a resource. */
  async listForResource(resourceId: string, ownerUserId: string): Promise<ShareGrant[]> {
    await this.ownership.assertOwned(resourceId, ownerUserId);
    return this.shareRepo.listForResource(resourceId);
  }

  /** Professional-side: summaries of resources shared with any of the given identities. */
  listForProfessionalIds(professionalIds: string[]): Promise<SharedResourceSummary[]> {
    return this.shareRepo.listForProfessionalIds(professionalIds);
  }

  /** Professional-side: hard authorization gate. */
  hasAccess(resourceId: string, professionalIds: string[]): Promise<boolean> {
    return this.shareRepo.hasAccess(resourceId, professionalIds);
  }
}
