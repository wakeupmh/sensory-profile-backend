import { FormDraft } from '../entities/FormDraft';

export interface FormDraftUpsertInput {
  id?: string;
  userId: string;
  formType: 'sensory_assessment' | 'anamnese';
  payload: Record<string, unknown>;
  currentStep: number;
  instrumentId?: string | null;
}

export interface FormDraftRepository {
  upsert(input: FormDraftUpsertInput): Promise<FormDraft>;
  findByUserAndType(userId: string, formType: string): Promise<FormDraft | null>;
  delete(userId: string, formType: string): Promise<void>;
}
