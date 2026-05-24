import { v7 as uuidv7 } from 'uuid';
import { DailyLog, LogData, LogType } from '../../domain/entities/DailyLog';
import { DailyLogRepository, DailyLogFilters } from '../../domain/repositories/DailyLogRepository';

export interface CreateLogPayload {
  childId: string;
  logType: LogType;
  occurredAt: Date;
  data: LogData;
  notes?: string | null;
}

export interface UpdateLogPayload {
  logType?: LogType;
  occurredAt?: Date;
  data?: LogData;
  notes?: string | null;
}

export class DailyLogService {
  constructor(private readonly repo: DailyLogRepository) {}

  list(userId: string, filters: DailyLogFilters) {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<DailyLog> {
    const log = await this.repo.findById(id, userId);
    if (!log) throw new Error(`Daily log ${id} not found`);
    return log;
  }

  create(payload: CreateLogPayload, userId: string): Promise<DailyLog> {
    return this.repo.save({ id: uuidv7(), userId, ...payload });
  }

  async update(id: string, payload: UpdateLogPayload, userId: string): Promise<DailyLog> {
    const updated = await this.repo.update(id, userId, payload);
    if (!updated) throw new Error(`Daily log ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`Daily log ${id} not found`);
  }
}
