import { TherapyType } from './Therapist';

export interface TherapySessionProps {
  id: string;
  userId: string;
  childId: string;
  therapistId: string | null;
  therapyType: TherapyType;
  occurredAt: Date;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TherapySessionSummary {
  id: string;
  childId: string;
  therapistId: string | null;
  therapyType: TherapyType;
  occurredAt: Date;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: Date;
}

export class TherapySession {
  constructor(private readonly props: TherapySessionProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getTherapistId(): string | null { return this.props.therapistId; }
  getTherapyType(): TherapyType { return this.props.therapyType; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getDurationMinutes(): number | null { return this.props.durationMinutes; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      therapistId: this.props.therapistId,
      therapyType: this.props.therapyType,
      occurredAt: this.props.occurredAt,
      durationMinutes: this.props.durationMinutes,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
