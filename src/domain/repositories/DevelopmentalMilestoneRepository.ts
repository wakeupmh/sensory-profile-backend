import { DevelopmentalMilestone, MilestoneCategory, MilestoneStatus } from '../entities/DevelopmentalMilestone';

export interface MilestoneCreateInput {
  id: string;
  userId: string;
  childId: string;
  title: string;
  category: MilestoneCategory;
  status?: MilestoneStatus;
  achievedDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
}

export interface MilestoneUpdateInput {
  title?: string;
  category?: MilestoneCategory;
  status?: MilestoneStatus;
  achievedDate?: string | null;
  targetDate?: string | null;
  notes?: string | null;
}

export interface MilestoneFilters {
  childId?: string;
  category?: MilestoneCategory;
  status?: MilestoneStatus;
}

export interface DevelopmentalMilestoneRepository {
  save(input: MilestoneCreateInput): Promise<DevelopmentalMilestone>;
  findById(id: string, userId: string): Promise<DevelopmentalMilestone | null>;
  findAllByUser(userId: string, filters: MilestoneFilters): Promise<DevelopmentalMilestone[]>;
  update(id: string, userId: string, input: MilestoneUpdateInput): Promise<DevelopmentalMilestone | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
