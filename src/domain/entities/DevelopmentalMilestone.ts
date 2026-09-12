import { Entity } from './Entity';

export type MilestoneCategory = 'motor_gross' | 'motor_fine' | 'language' | 'communication' | 'social' | 'cognitive' | 'self_care' | 'other';
export type MilestoneStatus = 'not_yet' | 'in_progress' | 'achieved' | 'regressed';

export interface DevelopmentalMilestoneProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  title: string;
  category: MilestoneCategory;
  status: MilestoneStatus;
  achievedDate: string | null;
  targetDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DevelopmentalMilestone extends Entity<DevelopmentalMilestoneProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getTitle(): string { return this.props.title; }
  getCategory(): MilestoneCategory { return this.props.category; }
  getStatus(): MilestoneStatus { return this.props.status; }
  isAchieved(): boolean { return this.props.status === 'achieved'; }
  getAchievedDate(): string | null { return this.props.achievedDate; }
  getTargetDate(): string | null { return this.props.targetDate; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

}
