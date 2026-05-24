import { v7 as uuidv7 } from 'uuid';
import { DevelopmentalMilestone, MilestoneCategory, MilestoneStatus } from '../../domain/entities/DevelopmentalMilestone';
import {
  DevelopmentalMilestoneRepository,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  MilestoneFilters,
} from '../../domain/repositories/DevelopmentalMilestoneRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

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

export class DevelopmentalMilestoneService {
  constructor(private readonly repo: DevelopmentalMilestoneRepository) {}

  list(userId: string, filters: MilestoneFilters): Promise<DevelopmentalMilestone[]> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<DevelopmentalMilestone> {
    const milestone = await this.repo.findById(id, userId);
    if (!milestone) throw new NotFoundError('Marco de desenvolvimento não encontrado', id);
    return milestone;
  }

  create(payload: CreateMilestonePayload, userId: string): Promise<DevelopmentalMilestone> {
    const input: MilestoneCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateMilestonePayload, userId: string): Promise<DevelopmentalMilestone> {
    const updated = await this.repo.update(id, userId, payload as MilestoneUpdateInput);
    if (!updated) throw new NotFoundError('Marco de desenvolvimento não encontrado', id);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new NotFoundError('Marco de desenvolvimento não encontrado', id);
  }
}
