import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';

import { Anamnese, AnamneseSummary } from '../../domain/entities/Anamnese';
import {
  AnamneseRepository,
  AnamneseCreateInput,
  AnamneseUpdateInput,
} from '../../domain/repositories/AnamneseRepository';
import { AnamneseNotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface AnamnesePayload {
  child: AnamneseCreateInput['child'];
  caregiver: AnamneseCreateInput['caregiver'];
  clinicalHistory: AnamneseCreateInput['clinicalHistory'];
}

export interface ShareLinkResult {
  shareToken: string;
  sharedAt: Date;
}

export class AnamneseService {
  constructor(private readonly repo: AnamneseRepository) {}

  list(userId: string): Promise<AnamneseSummary[]> {
    return this.repo.findAllByUser(userId);
  }

  async getById(id: string, userId: string): Promise<Anamnese> {
    const anamnese = await this.repo.findById(id, userId);
    if (!anamnese) throw new AnamneseNotFoundError(id);
    return anamnese;
  }

  create(payload: AnamnesePayload, userId: string): Promise<Anamnese> {
    return this.repo.save({
      id: uuidv7(),
      userId,
      child: payload.child,
      caregiver: payload.caregiver,
      clinicalHistory: payload.clinicalHistory,
    });
  }

  async update(
    id: string,
    payload: AnamnesePayload,
    userId: string
  ): Promise<Anamnese> {
    const updated = await this.repo.update(id, userId, payload as AnamneseUpdateInput);
    if (!updated) throw new AnamneseNotFoundError(id);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new AnamneseNotFoundError(id);
  }

  async generateShareLink(id: string, userId: string): Promise<ShareLinkResult> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) throw new AnamneseNotFoundError(id);

    if (existing.shareToken && existing.sharedAt) {
      return { shareToken: existing.shareToken, sharedAt: existing.sharedAt };
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const updated = await this.repo.setShareToken(id, userId, token);
    if (!updated) throw new AnamneseNotFoundError(id);

    return { shareToken: updated.shareToken!, sharedAt: updated.sharedAt! };
  }

  async revokeShareLink(id: string, userId: string): Promise<void> {
    const cleared = await this.repo.clearShareToken(id, userId);
    if (!cleared) throw new AnamneseNotFoundError(id);
  }

  async getByShareToken(token: string): Promise<Anamnese> {
    const anamnese = await this.repo.findByShareToken(token);
    if (!anamnese) throw new AnamneseNotFoundError(token);
    return anamnese;
  }
}
