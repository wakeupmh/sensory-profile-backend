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

export interface AiSummaryListResult {
  data: AiSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AiSummaryRepository {
  save(input: AiSummaryCreateInput): Promise<AiSummary>;
  findById(id: string, userId: string): Promise<AiSummary | null>;
  findAllByChild(childId: string, userId: string, page: number, limit: number): Promise<AiSummaryListResult>;
}
