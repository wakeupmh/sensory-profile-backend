import { AiSummary } from '../entities/AiSummary';

export interface AiSummaryCreateInput {
  id: string;
  userId: string;
  childId: string;
  periodFrom: Date;
  periodTo: Date;
  modelId: string;
  content: string;
}

export interface AiSummaryRepository {
  save(input: AiSummaryCreateInput): Promise<AiSummary>;
  findById(id: string, userId: string): Promise<AiSummary | null>;
  findAllByChild(childId: string, userId: string): Promise<AiSummary[]>;
}
