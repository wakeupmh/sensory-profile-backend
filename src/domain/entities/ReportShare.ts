import { Entity } from './Entity';

export interface ReportShareProps {
  id: string;
  userId: string;
  childId: string;
  token: string;
  periodDays: number;
  expiresAt: Date;
  createdAt: Date;
}

export class ReportShare extends Entity<ReportShareProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getToken(): string { return this.props.token; }
  getPeriodDays(): number { return this.props.periodDays; }
  getExpiresAt(): Date { return this.props.expiresAt; }
  getCreatedAt(): Date { return this.props.createdAt; }

}
