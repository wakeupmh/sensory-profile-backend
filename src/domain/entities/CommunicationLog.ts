import { Entity } from './Entity';

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
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  occurredAt: Date;
  entryType: CommunicationEntryType;
  description: string | null;
  wordsCount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CommunicationLog extends Entity<CommunicationLogProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getEntryType(): CommunicationEntryType { return this.props.entryType; }
  getDescription(): string | null { return this.props.description; }
  getWordsCount(): number | null { return this.props.wordsCount; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

}
