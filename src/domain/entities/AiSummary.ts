import { Entity } from './Entity';

export interface AiSummaryProps {
  id: string;
  userId: string;
  childId: string;
  periodFrom: Date;
  periodTo: Date;
  modelId: string;
  content: string;
  createdAt: Date;
}

export class AiSummary extends Entity<AiSummaryProps, 'userId'> {

  protected hiddenFields() {
    return ['userId'] as const;
  }

  getId(): string { return this.props.id; }
  getChildId(): string { return this.props.childId; }

}
