export interface ShareGrant {
  id: string;
  resourceId: string;
  professionalId: string;
  professionalName: string;
  professionalEmail: string | null;
  professionalProfession: string | null;
  professionalStatus: 'pending' | 'accepted';
  grantedByUserId: string;
  createdAt: Date;
}

export interface SharedResourceSummary {
  resourceId: string;
  professionalId: string;
  ownerUserId: string;
  sharedAt: Date;
}

/**
 * Shared interface for the two share tables (anamnese_shares,
 * assessment_shares). Each implementation targets a single underlying table.
 */
export interface ResourceShareRepository {
  /** Grant share. Idempotent — returning the existing row if already shared. */
  grant(resourceId: string, professionalId: string, grantedByUserId: string): Promise<ShareGrant>;

  /** Revoke share. Returns false if no row matched (already revoked). */
  revoke(resourceId: string, professionalId: string): Promise<boolean>;

  /** List who has access to a given resource (joined with professionals). */
  listForResource(resourceId: string): Promise<ShareGrant[]>;

  /** List resources shared with a given professional (used for /api/shared/*). */
  listForProfessionalIds(professionalIds: string[]): Promise<SharedResourceSummary[]>;

  /** Check whether a specific professional has access to a specific resource. */
  hasAccess(resourceId: string, professionalIds: string[]): Promise<boolean>;
}
