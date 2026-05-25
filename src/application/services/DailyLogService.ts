import { DailyLog, LogData, LogType } from '../../domain/entities/DailyLog';
import { DailyLogRepository, DailyLogCreateInput, DailyLogFilters } from '../../domain/repositories/DailyLogRepository';
import { BaseDomainService } from './BaseDomainService';

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

export class DailyLogService extends BaseDomainService<
  DailyLog,
  DailyLogCreateInput,
  UpdateLogPayload,
  CreateLogPayload,
  UpdateLogPayload,
  DailyLogFilters
> {
  constructor(repo: DailyLogRepository) {
    super(repo, 'Registro diário não encontrado');
  }
}
