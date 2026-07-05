import { ProfessionalNote } from '../entities/ProfessionalNote';

export interface ProfessionalNoteCreateInput {
  id: string;
  professionalId: string;
  authorUserId: string;
  childId: string;
  resourceType?: string | null;
  resourceId?: string | null;
  content: string;
}

export interface ProfessionalNoteUpdateInput {
  content: string;
}

export interface ProfessionalNoteRepository {
  save(input: ProfessionalNoteCreateInput): Promise<ProfessionalNote>;
  findById(id: string): Promise<ProfessionalNote | null>;
  /** Owner-side: every note attached to a child, from any professional. */
  findAllByChild(childId: string): Promise<ProfessionalNote[]>;
  /** Professional-side: only the notes a specific professional identity authored for a child. */
  findAllByChildAndProfessional(childId: string, professionalId: string): Promise<ProfessionalNote[]>;
  /** Author-only update/delete — enforced by matching professionalId, not just id. */
  update(id: string, professionalId: string, input: ProfessionalNoteUpdateInput): Promise<ProfessionalNote | null>;
  delete(id: string, professionalId: string): Promise<boolean>;
}
