import { Entity } from './Entity';

export interface FormDraftProps {
  id: string;
  userId: string;
  formType: 'sensory_assessment' | 'anamnese';
  payload: Record<string, unknown>;
  currentStep: number;
  instrumentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FormDraft extends Entity<FormDraftProps, 'userId'> {

  protected hiddenFields() {
    return ['userId'] as const;
  }

}
