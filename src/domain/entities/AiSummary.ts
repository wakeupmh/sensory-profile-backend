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

export class AiSummary {
  constructor(private readonly props: AiSummaryProps) {}

  getId(): string { return this.props.id; }
  getChildId(): string { return this.props.childId; }

  toJSON() {
    return {
      id: this.props.id,
      childId: this.props.childId,
      periodFrom: this.props.periodFrom,
      periodTo: this.props.periodTo,
      modelId: this.props.modelId,
      content: this.props.content,
      createdAt: this.props.createdAt,
    };
  }
}
