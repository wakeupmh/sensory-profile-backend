import { Goal, GoalDomain, GoalStatus } from '../../domain/entities/Goal';
import {
  GoalRepository,
  GoalCreateInput,
  GoalUpdateInput,
  GoalFilters,
} from '../../domain/repositories/GoalRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateGoalPayload {
  childId: string;
  domain: GoalDomain;
  title: string;
  description?: string | null;
  masteryCriteria?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  unit?: string | null;
  status?: GoalStatus;
  targetDate?: string | null;
  sourceEducationPlanId?: string | null;
  notes?: string | null;
}

export class GoalService extends BaseDomainService<
  Goal,
  GoalCreateInput,
  GoalUpdateInput,
  CreateGoalPayload,
  GoalUpdateInput,
  GoalFilters
> {
  constructor(repo: GoalRepository) {
    super(repo, 'Meta não encontrada');
  }
}
