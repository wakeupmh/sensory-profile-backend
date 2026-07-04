import { Pool } from 'pg';
import { ChildShareGrant, ChildShareScope } from '../../domain/entities/ChildShare';
import { ChildShareRepository } from '../../domain/repositories/ChildShareRepository';
import { ProfessionalRepository } from '../../domain/repositories/ProfessionalRepository';
import { NotFoundError, ProfessionalNotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export class ChildShareService {
  constructor(
    private readonly repo: ChildShareRepository,
    private readonly professionalRepo: ProfessionalRepository,
    private readonly pool: Pool,
  ) {}

  private async assertChildOwnership(childId: string, ownerUserId: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, ownerUserId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
  }

  async grant(
    childId: string,
    professionalId: string,
    scopes: ChildShareScope[],
    ownerUserId: string,
  ): Promise<ChildShareGrant> {
    await this.assertChildOwnership(childId, ownerUserId);

    const professional = await this.professionalRepo.findByIdForOwner(professionalId, ownerUserId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    return this.repo.grant(childId, professionalId, ownerUserId, scopes);
  }

  async revoke(childId: string, professionalId: string, ownerUserId: string): Promise<void> {
    await this.assertChildOwnership(childId, ownerUserId);
    const ok = await this.repo.revoke(childId, professionalId);
    if (!ok) throw new NotFoundError('Compartilhamento', `${childId}/${professionalId}`);
  }

  async listForChild(childId: string, ownerUserId: string): Promise<ChildShareGrant[]> {
    await this.assertChildOwnership(childId, ownerUserId);
    return this.repo.listForChild(childId);
  }
}
