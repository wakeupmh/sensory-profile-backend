import { Comorbidity } from '../entities/Comorbidity';

export interface ComorbidityCreateInput {
  id: string;
  userId: string;
  childId: string;
  conditionName: string;
  icdCode?: string | null;
  diagnosisDate?: string | null;
  diagnosingDoctor?: string | null;
  notes?: string | null;
}

export interface ComorbidityUpdateInput {
  conditionName?: string;
  icdCode?: string | null;
  diagnosisDate?: string | null;
  diagnosingDoctor?: string | null;
  notes?: string | null;
}

export interface ComorbidityRepository {
  save(input: ComorbidityCreateInput): Promise<Comorbidity>;
  findById(id: string, userId: string): Promise<Comorbidity | null>;
  findAllByUser(userId: string, filters: { childId?: string }): Promise<Comorbidity[]>;
  update(id: string, userId: string, input: ComorbidityUpdateInput): Promise<Comorbidity | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
