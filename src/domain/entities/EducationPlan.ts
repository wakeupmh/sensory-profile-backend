import { Entity } from './Entity';

export type EducationPlanType = 'pei' | 'pei_simplificado' | 'adaptacao_curricular' | 'plano_aee' | 'outro';

export interface EducationPlanProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
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

export class EducationPlan extends Entity<EducationPlanProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
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

}
