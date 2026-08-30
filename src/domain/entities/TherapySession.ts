import { Entity } from './Entity';

import { TherapyType } from './Therapist';

export interface TherapySessionProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
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

export class TherapySession extends Entity<TherapySessionProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getTherapistId(): string | null { return this.props.therapistId; }
  getTherapyType(): TherapyType { return this.props.therapyType; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getDurationMinutes(): number | null { return this.props.durationMinutes; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

}
