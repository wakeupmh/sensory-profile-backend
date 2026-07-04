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

export class Goal {
  constructor(private readonly props: GoalProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getDomain(): GoalDomain { return this.props.domain; }
  getTitle(): string { return this.props.title; }
  getStatus(): GoalStatus { return this.props.status; }
  getBaselineValue(): number | null { return this.props.baselineValue; }
  getTargetValue(): number | null { return this.props.targetValue; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      domain: this.props.domain,
      title: this.props.title,
      description: this.props.description,
      masteryCriteria: this.props.masteryCriteria,
      baselineValue: this.props.baselineValue,
      targetValue: this.props.targetValue,
      unit: this.props.unit,
      status: this.props.status,
      targetDate: this.props.targetDate,
      sourceEducationPlanId: this.props.sourceEducationPlanId,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
