import { Goal, GoalDomain, GoalStatus } from '../entities/Goal';

export interface GoalCreateInput {
  id: string;
  userId: string;
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

export interface GoalUpdateInput {
  domain?: GoalDomain;
  title?: string;
  description?: string | null;
  masteryCriteria?: string | null;
  baselineValue?: number | null;
  targetValue?: number | null;
  unit?: string | null;
  status?: GoalStatus;
  targetDate?: string | null;
  notes?: string | null;
}

export interface GoalFilters {
  childId?: string;
  domain?: GoalDomain;
  status?: GoalStatus;
}

export interface GoalRepository {
  save(input: GoalCreateInput): Promise<Goal>;
  findById(id: string, userId: string): Promise<Goal | null>;
  findAllByUser(userId: string, filters: GoalFilters): Promise<Goal[]>;
  update(id: string, userId: string, input: GoalUpdateInput): Promise<Goal | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
