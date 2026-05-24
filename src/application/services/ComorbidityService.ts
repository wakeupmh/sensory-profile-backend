import { v7 as uuidv7 } from 'uuid';
import { Comorbidity } from '../../domain/entities/Comorbidity';
import { ComorbidityRepository, ComorbidityCreateInput, ComorbidityUpdateInput } from '../../domain/repositories/ComorbidityRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface CreateComorbidityPayload {
  childId: string;
  conditionName: string;
  icdCode?: string | null;
  diagnosisDate?: string | null;
  diagnosingDoctor?: string | null;
  notes?: string | null;
}

export interface UpdateComorbidityPayload {
  conditionName?: string;
  icdCode?: string | null;
  diagnosisDate?: string | null;
  diagnosingDoctor?: string | null;
  notes?: string | null;
}

export class ComorbidityService {
  constructor(private readonly repo: ComorbidityRepository) {}

  list(userId: string, filters: { childId?: string }): Promise<Comorbidity[]> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<Comorbidity> {
    const comorbidity = await this.repo.findById(id, userId);
    if (!comorbidity) throw new NotFoundError('Comorbidade não encontrada', id);
    return comorbidity;
  }

  create(payload: CreateComorbidityPayload, userId: string): Promise<Comorbidity> {
    const input: ComorbidityCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateComorbidityPayload, userId: string): Promise<Comorbidity> {
    const updated = await this.repo.update(id, userId, payload as ComorbidityUpdateInput);
    if (!updated) throw new NotFoundError('Comorbidade não encontrada', id);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new NotFoundError('Comorbidade não encontrada', id);
  }
}
