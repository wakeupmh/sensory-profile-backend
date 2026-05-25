import { EducationPlan, EducationPlanType } from '../entities/EducationPlan';

export interface EducationPlanCreateInput {
  id: string;
  userId: string;
  childId: string;
  schoolName: string;
  academicYear: string;
  planType: EducationPlanType;
  startDate: string;
  reviewDate?: string | null;
  endDate?: string | null;
  goals?: string | null;
  accommodations?: string | null;
  notes?: string | null;
}

export interface EducationPlanUpdateInput {
  schoolName?: string;
  academicYear?: string;
  planType?: EducationPlanType;
  startDate?: string;
  reviewDate?: string | null;
  endDate?: string | null;
  goals?: string | null;
  accommodations?: string | null;
  notes?: string | null;
}

export interface EducationPlanFilters {
  childId?: string;
  academicYear?: string;
  planType?: EducationPlanType;
}

export interface EducationPlanRepository {
  save(input: EducationPlanCreateInput): Promise<EducationPlan>;
  findById(id: string, userId: string): Promise<EducationPlan | null>;
  findAllByUser(userId: string, filters: EducationPlanFilters): Promise<EducationPlan[]>;
  update(id: string, userId: string, input: EducationPlanUpdateInput): Promise<EducationPlan | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
