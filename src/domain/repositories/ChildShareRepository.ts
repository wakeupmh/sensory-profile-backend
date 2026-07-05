import { ChildShareGrant, ChildShareScope } from '../entities/ChildShare';

export interface ProfessionalChildAccess {
  childId: string;
  professionalId: string;
  scopes: ChildShareScope[];
}

export interface ChildShareRepository {
  /** Creates the grant, or updates `scopes` if the pair already exists. */
  grant(
    childId: string,
    professionalId: string,
    grantedByUserId: string,
    scopes: ChildShareScope[],
  ): Promise<ChildShareGrant>;

  revoke(childId: string, professionalId: string): Promise<boolean>;

  /** Owner-side: everyone with access to a given child. */
  listForChild(childId: string): Promise<ChildShareGrant[]>;

  /** Professional-side: every child + scope set granted to any of the given professional identities. */
  listForProfessionalIds(professionalIds: string[]): Promise<ProfessionalChildAccess[]>;

  hasScope(childId: string, professionalIds: string[], scope: ChildShareScope): Promise<boolean>;

  /** True if any of the given professional identities has ANY grant for this child, regardless of scope. */
  hasAnyAccess(childId: string, professionalIds: string[]): Promise<boolean>;

  /**
   * Which one of the caller's professional identities has a grant for this
   * child (a caller can hold several identities — one per owner who invited
   * them — but at most one of them is normally tied to a given child).
   * Returns null if none match.
   */
  resolveAccessProfessionalId(childId: string, professionalIds: string[]): Promise<string | null>;
}
