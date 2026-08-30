import { Entity } from './Entity';

export type SchoolCommType = 'reuniao' | 'bilhete' | 'email' | 'telefone' | 'incidente' | 'relatorio' | 'outro';

export interface SchoolCommunicationSummary {
  id: string;
  childId: string;
  occurredAt: Date;
  commType: SchoolCommType;
  subject: string;
  attendees: string | null;
  followUpDate: string | null;
  createdAt: Date;
}

export interface SchoolCommunicationProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  occurredAt: Date;             // TIMESTAMPTZ → Date
  commType: SchoolCommType;
  subject: string;
  description: string | null;
  attendees: string | null;
  followUpDate: string | null;  // DATE → string | null
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SchoolCommunication extends Entity<SchoolCommunicationProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getCommType(): SchoolCommType { return this.props.commType; }
  getSubject(): string { return this.props.subject; }
  getDescription(): string | null { return this.props.description; }
  getAttendees(): string | null { return this.props.attendees; }
  getFollowUpDate(): string | null { return this.props.followUpDate; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

}
