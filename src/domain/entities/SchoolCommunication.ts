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

export class SchoolCommunication {
  constructor(private readonly props: SchoolCommunicationProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
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

  toJSON(): SchoolCommunicationProps {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      occurredAt: this.props.occurredAt,
      commType: this.props.commType,
      subject: this.props.subject,
      description: this.props.description,
      attendees: this.props.attendees,
      followUpDate: this.props.followUpDate,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
