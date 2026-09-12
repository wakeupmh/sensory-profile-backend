import { Entity } from './Entity';

export type GoalDomain =
  | 'comunicacao'
  | 'social'
  | 'motor'
  | 'autocuidado'
  | 'academico'
  | 'comportamental'
  | 'outro';

export type GoalStatus = 'active' | 'achieved' | 'paused' | 'discontinued';

export interface GoalProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  domain: GoalDomain;
  title: string;
  description: string | null;
  masteryCriteria: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  unit: string | null;
  status: GoalStatus;
  targetDate: string | null;
  sourceEducationPlanId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Goal extends Entity<GoalProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getDomain(): GoalDomain { return this.props.domain; }
  getTitle(): string { return this.props.title; }
  getStatus(): GoalStatus { return this.props.status; }
  getBaselineValue(): number | null { return this.props.baselineValue; }
  getTargetValue(): number | null { return this.props.targetValue; }

}
