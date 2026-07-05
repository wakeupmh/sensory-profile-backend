import { v7 as uuidv7 } from 'uuid';
import { Pool } from 'pg';
import { ProfessionalNote } from '../../domain/entities/ProfessionalNote';
import { ProfessionalNoteRepository } from '../../domain/repositories/ProfessionalNoteRepository';
import { ChildShareRepository } from '../../domain/repositories/ChildShareRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface CreateProfessionalNotePayload {
  childId: string;
  resourceType?: string | null;
  resourceId?: string | null;
  content: string;
}

/**
 * Professionals never mutate the owner's own records. A "note" is a
 * separate, professional-authored annotation attached to a child (and
 * optionally to a specific resource within it) — additive, not an edit of
 * existing data. Requires a child_shares grant (any scope) as proof of an
 * active care-team relationship; per-resource anamnese/assessment shares
 * alone do not grant note-writing in this version.
 */
export class ProfessionalNoteService {
  constructor(
    private readonly repo: ProfessionalNoteRepository,
    private readonly childShareRepo: ChildShareRepository,
    private readonly pool: Pool,
  ) {}

  /** Resolves which of the caller's professional identities is tied to this child. 404 if none. */
  private async resolveProfessionalId(childId: string, professionalIds: string[]): Promise<string> {
    const professionalId = await this.childShareRepo.resolveAccessProfessionalId(childId, professionalIds);
    if (!professionalId) throw new NotFoundError('Criança', childId);
    return professionalId;
  }

  async create(
    payload: CreateProfessionalNotePayload,
    professionalIds: string[],
    authorUserId: string,
  ): Promise<ProfessionalNote> {
    const professionalId = await this.resolveProfessionalId(payload.childId, professionalIds);
    return this.repo.save({
      id: uuidv7(),
      professionalId,
      authorUserId,
      childId: payload.childId,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
      content: payload.content,
    });
  }

  async listMineForChild(childId: string, professionalIds: string[]): Promise<ProfessionalNote[]> {
    const professionalId = await this.resolveProfessionalId(childId, professionalIds);
    return this.repo.findAllByChildAndProfessional(childId, professionalId);
  }

  async update(id: string, content: string, professionalIds: string[]): Promise<ProfessionalNote> {
    for (const professionalId of professionalIds) {
      const updated = await this.repo.update(id, professionalId, { content });
      if (updated) return updated;
    }
    throw new NotFoundError('Nota', id);
  }

  async remove(id: string, professionalIds: string[]): Promise<void> {
    for (const professionalId of professionalIds) {
      const ok = await this.repo.delete(id, professionalId);
      if (ok) return;
    }
    throw new NotFoundError('Nota', id);
  }

  /** Owner-side: every note left by any professional for their child. */
  async listForOwner(childId: string, ownerUserId: string): Promise<ProfessionalNote[]> {
    const result = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, ownerUserId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
    return this.repo.findAllByChild(childId);
  }
}
