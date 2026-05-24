import { v7 as uuidv7 } from 'uuid';
import { EducationPlan, EducationPlanType } from '../../domain/entities/EducationPlan';
import { EducationPlanRepository, EducationPlanFilters } from '../../domain/repositories/EducationPlanRepository';

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

export class EducationPlanService {
  constructor(private readonly repo: EducationPlanRepository) {}

  list(userId: string, filters: EducationPlanFilters): Promise<EducationPlan[]> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<EducationPlan> {
    const plan = await this.repo.findById(id, userId);
    if (!plan) throw new Error(`EducationPlan ${id} not found`);
    return plan;
  }

  create(payload: CreateEducationPlanPayload, userId: string): Promise<EducationPlan> {
    return this.repo.save({
      id: uuidv7(),
      userId,
      ...payload,
    });
  }

  async update(id: string, payload: UpdateEducationPlanPayload, userId: string): Promise<EducationPlan> {
    const updated = await this.repo.update(id, userId, payload);
    if (!updated) throw new Error(`EducationPlan ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`EducationPlan ${id} not found`);
  }
}
