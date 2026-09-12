import { Entity } from './Entity';

import { GoalStatus } from './Goal';

export interface GoalProgressEntryProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  goalId: string;
  recordedAt: Date;
  value: number | null;
  statusSnapshot: GoalStatus | null;
  notes: string | null;
  therapySessionId: string | null;
  createdAt: Date;
}

export class GoalProgressEntry extends Entity<GoalProgressEntryProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getGoalId(): string { return this.props.goalId; }
  getRecordedAt(): Date { return this.props.recordedAt; }
  getValue(): number | null { return this.props.value; }

}
