import { DevelopmentalMilestone, MilestoneCategory, MilestoneStatus } from '../../domain/entities/DevelopmentalMilestone';
import {
  DevelopmentalMilestoneRepository,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  MilestoneFilters,
} from '../../domain/repositories/DevelopmentalMilestoneRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateMilestonePayload {
  childId: string;
  title: string;
  category: MilestoneCategory;
  status?: MilestoneStatus;
  achievedDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
}

export interface UpdateMilestonePayload {
  title?: string;
  category?: MilestoneCategory;
  status?: MilestoneStatus;
  achievedDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
}

export class DevelopmentalMilestoneService extends BaseDomainService<
  DevelopmentalMilestone,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  CreateMilestonePayload,
  UpdateMilestonePayload,
  MilestoneFilters
> {
  constructor(repo: DevelopmentalMilestoneRepository) {
    super(repo, 'Marco de desenvolvimento não encontrado');
  }
}
