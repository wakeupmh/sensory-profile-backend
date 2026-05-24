export type EducationPlanType = 'pei' | 'pei_simplificado' | 'adaptacao_curricular' | 'plano_aee' | 'outro';

export interface EducationPlanProps {
  id: string;
  userId: string;
  childId: string;
  schoolName: string;
  academicYear: string;
  planType: EducationPlanType;
  startDate: string;           // DATE → string (required, NOT NULL)
  reviewDate: string | null;   // DATE → string | null
  endDate: string | null;      // DATE → string | null
  goals: string | null;
  accommodations: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EducationPlan {
  constructor(private readonly props: EducationPlanProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getSchoolName(): string { return this.props.schoolName; }
  getAcademicYear(): string { return this.props.academicYear; }
  getPlanType(): EducationPlanType { return this.props.planType; }
  getStartDate(): string { return this.props.startDate; }
  getReviewDate(): string | null { return this.props.reviewDate; }
  getEndDate(): string | null { return this.props.endDate; }
  getGoals(): string | null { return this.props.goals; }
  getAccommodations(): string | null { return this.props.accommodations; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON(): EducationPlanProps {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      schoolName: this.props.schoolName,
      academicYear: this.props.academicYear,
      planType: this.props.planType,
      startDate: this.props.startDate,
      reviewDate: this.props.reviewDate,
      endDate: this.props.endDate,
      goals: this.props.goals,
      accommodations: this.props.accommodations,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
