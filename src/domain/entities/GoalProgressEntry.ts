import { GoalStatus } from './Goal';

export interface GoalProgressEntryProps {
  id: string;
  userId: string;
  goalId: string;
  recordedAt: Date;
  value: number | null;
  statusSnapshot: GoalStatus | null;
  notes: string | null;
  therapySessionId: string | null;
  createdAt: Date;
}

export class GoalProgressEntry {
  constructor(private readonly props: GoalProgressEntryProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getGoalId(): string { return this.props.goalId; }
  getRecordedAt(): Date { return this.props.recordedAt; }
  getValue(): number | null { return this.props.value; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      goalId: this.props.goalId,
      recordedAt: this.props.recordedAt,
      value: this.props.value,
      statusSnapshot: this.props.statusSnapshot,
      notes: this.props.notes,
      therapySessionId: this.props.therapySessionId,
      createdAt: this.props.createdAt,
    };
  }
}
