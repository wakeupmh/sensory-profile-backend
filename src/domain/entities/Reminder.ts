export type ReminderStatus = 'pending' | 'done' | 'dismissed';

export interface ReminderProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  title: string;
  dueAt: Date;
  status: ReminderStatus;
  resourceType: string | null;
  resourceId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Reminder {
  constructor(private readonly props: ReminderProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getTitle(): string { return this.props.title; }
  getDueAt(): Date { return this.props.dueAt; }
  getStatus(): ReminderStatus { return this.props.status; }
  getResourceType(): string | null { return this.props.resourceType; }
  getResourceId(): string | null { return this.props.resourceId; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      authorUserId: this.props.authorUserId,
      childId: this.props.childId,
      title: this.props.title,
      dueAt: this.props.dueAt,
      status: this.props.status,
      resourceType: this.props.resourceType,
      resourceId: this.props.resourceId,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
