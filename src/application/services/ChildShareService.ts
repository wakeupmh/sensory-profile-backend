import { Pool } from 'pg';
import { ChildShareGrant, ChildShareScope } from '../../domain/entities/ChildShare';
import { ChildShareRepository } from '../../domain/repositories/ChildShareRepository';
import { ProfessionalRepository } from '../../domain/repositories/ProfessionalRepository';
import { NotFoundError, ProfessionalNotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import { assertChildOwned } from './childAccess';

export class ChildShareService {
  constructor(
    private readonly repo: ChildShareRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly pool: Pool,
  ) {}


  async grant(
    childId: string,
    professionalId: string,
    scopes: ChildShareScope[],
    ownerUserId: string,
  ): Promise<ChildShareGrant> {
    await assertChildOwned(this.pool, childId, ownerUserId);

    const professional = await this.professionalRepo.findByIdForOwner(professionalId, ownerUserId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    return this.repo.grant(childId, professionalId, ownerUserId, scopes);
  }

  async revoke(childId: string, professionalId: string, ownerUserId: string): Promise<void> {
    await assertChildOwned(this.pool, childId, ownerUserId);
    const ok = await this.repo.revoke(childId, professionalId);
    if (!ok) throw new NotFoundError('Compartilhamento', `${childId}/${professionalId}`);
  }

  async listForChild(childId: string, ownerUserId: string): Promise<ChildShareGrant[]> {
    await assertChildOwned(this.pool, childId, ownerUserId);
    return this.repo.listForChild(childId);
  }
}
