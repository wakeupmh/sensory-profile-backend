import {
  Anamnese,
  AnamneseChild,
  AnamneseCaregiver,
  AnamneseClinicalHistory,
  AnamneseSummary,
} from '../entities/Anamnese';

export interface AnamneseCreateInput {
  id: string;
  userId: string;
  child: AnamneseChild;
  caregiver: AnamneseCaregiver;
  clinicalHistory: AnamneseClinicalHistory;
}

export interface AnamneseUpdateInput {
  child?: AnamneseChild;
  caregiver?: AnamneseCaregiver;
  clinicalHistory?: AnamneseClinicalHistory;
}

export interface AnamneseRepository {
  findAllByUser(userId: string): Promise<AnamneseSummary[]>;
  findById(id: string, userId: string): Promise<Anamnese | null>;
  /**
   * Fetch by id with no ownership filter. Use only on paths that have already
   * authorized the caller via another channel (public share token, share
   * grant to a professional, etc).
   */
  findByIdAnyOwner(id: string): Promise<Anamnese | null>;
  findByShareToken(token: string): Promise<Anamnese | null>;
  save(input: AnamneseCreateInput): Promise<Anamnese>;
  update(id: string, userId: string, input: AnamneseUpdateInput): Promise<Anamnese | null>;
  delete(id: string, userId: string): Promise<boolean>;
  setShareToken(id: string, userId: string, token: string): Promise<Anamnese | null>;
  clearShareToken(id: string, userId: string): Promise<Anamnese | null>;
}
