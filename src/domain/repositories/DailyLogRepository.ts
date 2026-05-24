import { DailyLog, DailyLogSummary, LogData, LogType } from '../entities/DailyLog';

export interface DailyLogCreateInput {
  id: string;
  userId: string;
  childId: string;
  logType: LogType;
  occurredAt: Date;
  data: LogData;
  notes?: string | null;
}

export interface DailyLogUpdateInput {
  logType?: LogType;
  occurredAt?: Date;
  data?: LogData;
  notes?: string | null;
}

export interface DailyLogFilters {
  childId?: string;
  logType?: LogType;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface DailyLogRepository {
  save(input: DailyLogCreateInput): Promise<DailyLog>;
  findById(id: string, userId: string): Promise<DailyLog | null>;
  findAllByUser(userId: string, filters: DailyLogFilters): Promise<{ data: DailyLogSummary[]; total: number; page: number; limit: number }>;
  update(id: string, userId: string, input: DailyLogUpdateInput): Promise<DailyLog | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
