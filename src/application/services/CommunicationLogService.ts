import { v7 as uuidv7 } from 'uuid';
import { CommunicationLog, CommunicationEntryType, CommunicationLogSummary } from '../../domain/entities/CommunicationLog';
import {
  CommunicationLogRepository,
  CommunicationLogCreateInput,
  CommunicationLogUpdateInput,
  CommunicationLogFilters,
} from '../../domain/repositories/CommunicationLogRepository';

export interface CreateCommunicationLogPayload {
  childId: string;
  occurredAt: Date;
  entryType: CommunicationEntryType;
  description?: string | null;
  wordsCount?: number | null;
  notes?: string | null;
}

export interface UpdateCommunicationLogPayload {
  occurredAt?: Date;
  entryType?: CommunicationEntryType;
  description?: string | null;
  wordsCount?: number | null;
  notes?: string | null;
}

export class CommunicationLogService {
  constructor(private readonly repo: CommunicationLogRepository) {}

  list(
    userId: string,
    filters: CommunicationLogFilters,
  ): Promise<{ data: CommunicationLogSummary[]; total: number; page: number; limit: number }> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<CommunicationLog> {
    const log = await this.repo.findById(id, userId);
    if (!log) throw new Error(`CommunicationLog ${id} not found`);
    return log;
  }

  create(payload: CreateCommunicationLogPayload, userId: string): Promise<CommunicationLog> {
    const input: CommunicationLogCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateCommunicationLogPayload, userId: string): Promise<CommunicationLog> {
    const updated = await this.repo.update(id, userId, payload as CommunicationLogUpdateInput);
    if (!updated) throw new Error(`CommunicationLog ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`CommunicationLog ${id} not found`);
  }
}
