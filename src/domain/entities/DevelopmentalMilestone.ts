export type MilestoneCategory = 'motor_gross' | 'motor_fine' | 'language' | 'communication' | 'social' | 'cognitive' | 'self_care' | 'other';
export type MilestoneStatus = 'not_yet' | 'in_progress' | 'achieved' | 'regressed';

export interface DevelopmentalMilestoneProps {
  id: string;
  userId: string;
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

export class DevelopmentalMilestone {
  constructor(private readonly props: DevelopmentalMilestoneProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
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

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      title: this.props.title,
      category: this.props.category,
      status: this.props.status,
      achievedDate: this.props.achievedDate,
      targetDate: this.props.targetDate,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
