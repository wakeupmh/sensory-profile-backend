import { Comorbidity } from '../../domain/entities/Comorbidity';
import { ComorbidityRepository, ComorbidityCreateInput, ComorbidityUpdateInput } from '../../domain/repositories/ComorbidityRepository';
import { BaseDomainService } from './BaseDomainService';

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

export class ComorbidityService extends BaseDomainService<
  Comorbidity,
  ComorbidityCreateInput,
  ComorbidityUpdateInput,
  CreateComorbidityPayload,
  UpdateComorbidityPayload,
  { childId?: string }
> {
  constructor(repo: ComorbidityRepository) {
    super(repo, 'Comorbidade não encontrada');
  }
}
