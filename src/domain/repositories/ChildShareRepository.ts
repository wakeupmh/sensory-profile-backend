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
}
