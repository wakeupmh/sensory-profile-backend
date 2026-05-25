import { EducationPlan, EducationPlanType } from '../../domain/entities/EducationPlan';
import { EducationPlanRepository, EducationPlanFilters } from '../../domain/repositories/EducationPlanRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateEducationPlanPayload {
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

export interface UpdateEducationPlanPayload {
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

export class EducationPlanService extends BaseDomainService<
  EducationPlan,
  { id: string; userId: string } & CreateEducationPlanPayload,
  UpdateEducationPlanPayload,
  CreateEducationPlanPayload,
  UpdateEducationPlanPayload,
  EducationPlanFilters
> {
  constructor(repo: EducationPlanRepository) {
    super(repo, 'Plano educacional não encontrado');
  }
}
