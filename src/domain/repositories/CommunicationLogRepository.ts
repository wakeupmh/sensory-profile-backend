import { CommunicationLog, CommunicationLogSummary, CommunicationEntryType } from '../entities/CommunicationLog';
export type { CommunicationLogSummary };

export interface CommunicationLogCreateInput {
  id: string;
  userId: string;
  childId: string;
  occurredAt: Date;
  entryType: CommunicationEntryType;
  description?: string | null;
  wordsCount?: number | null;
  notes?: string | null;
}

export interface CommunicationLogUpdateInput {
  occurredAt?: Date;
  entryType?: CommunicationEntryType;
  description?: string | null;
  wordsCount?: number | null;
  notes?: string | null;
}

export interface CommunicationLogFilters {
  childId?: string;
  entryType?: CommunicationEntryType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CommunicationLogRepository {
  save(input: CommunicationLogCreateInput): Promise<CommunicationLog>;
  findById(id: string, userId: string): Promise<CommunicationLog | null>;
  findAllByUser(
    userId: string,
    filters: CommunicationLogFilters,
  ): Promise<{ data: CommunicationLogSummary[]; total: number; page: number; limit: number }>;
  update(id: string, userId: string, input: CommunicationLogUpdateInput): Promise<CommunicationLog | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
