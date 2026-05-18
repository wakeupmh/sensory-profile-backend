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

export class FormDraft {
  constructor(private readonly props: FormDraftProps) {}

  toJSON() {
    return {
      id: this.props.id,
      formType: this.props.formType,
      payload: this.props.payload,
      currentStep: this.props.currentStep,
      instrumentId: this.props.instrumentId,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
