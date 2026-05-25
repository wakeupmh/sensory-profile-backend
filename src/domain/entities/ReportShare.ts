export interface ReportShareProps {
  id: string;
  userId: string;
  childId: string;
  token: string;
  periodDays: number;
  expiresAt: Date;
  createdAt: Date;
}

export class ReportShare {
  constructor(private readonly props: ReportShareProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getToken(): string { return this.props.token; }
  getPeriodDays(): number { return this.props.periodDays; }
  getExpiresAt(): Date { return this.props.expiresAt; }
  getCreatedAt(): Date { return this.props.createdAt; }

  toJSON(): ReportShareProps {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      token: this.props.token,
      periodDays: this.props.periodDays,
      expiresAt: this.props.expiresAt,
      createdAt: this.props.createdAt,
    };
  }
}
