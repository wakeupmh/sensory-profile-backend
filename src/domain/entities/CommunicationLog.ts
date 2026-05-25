export type CommunicationEntryType = 'vocabulary' | 'aac_usage' | 'verbal_speech' | 'signs' | 'other';

export interface CommunicationLogSummary {
  id: string;
  childId: string;
  occurredAt: Date;
  entryType: CommunicationEntryType;
  description: string | null;
  wordsCount: number | null;
  createdAt: Date;
}

export interface CommunicationLogProps {
  id: string;
  userId: string;
  childId: string;
  occurredAt: Date;
  entryType: CommunicationEntryType;
  description: string | null;
  wordsCount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CommunicationLog {
  constructor(private readonly props: CommunicationLogProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getEntryType(): CommunicationEntryType { return this.props.entryType; }
  getDescription(): string | null { return this.props.description; }
  getWordsCount(): number | null { return this.props.wordsCount; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      occurredAt: this.props.occurredAt,
      entryType: this.props.entryType,
      description: this.props.description,
      wordsCount: this.props.wordsCount,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
