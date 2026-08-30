export interface ComorbidityProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  conditionName: string;
  icdCode: string | null;
  diagnosisDate: string | null;
  diagnosingDoctor: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Comorbidity {
  constructor(private readonly props: ComorbidityProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getConditionName(): string { return this.props.conditionName; }
  getIcdCode(): string | null { return this.props.icdCode; }
  getDiagnosisDate(): string | null { return this.props.diagnosisDate; }
  getDiagnosingDoctor(): string | null { return this.props.diagnosingDoctor; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      authorUserId: this.props.authorUserId,
      childId: this.props.childId,
      conditionName: this.props.conditionName,
      icdCode: this.props.icdCode,
      diagnosisDate: this.props.diagnosisDate,
      diagnosingDoctor: this.props.diagnosingDoctor,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
