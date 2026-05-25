import { CommunicationLog, CommunicationEntryType } from '../../domain/entities/CommunicationLog';
import {
  CommunicationLogRepository,
  CommunicationLogCreateInput,
  CommunicationLogUpdateInput,
  CommunicationLogFilters,
} from '../../domain/repositories/CommunicationLogRepository';
import { BaseDomainService } from './BaseDomainService';

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

export class CommunicationLogService extends BaseDomainService<
  CommunicationLog,
  CommunicationLogCreateInput,
  CommunicationLogUpdateInput,
  CreateCommunicationLogPayload,
  UpdateCommunicationLogPayload,
  CommunicationLogFilters
> {
  constructor(repo: CommunicationLogRepository) {
    super(repo, 'Registro de comunicação não encontrado');
  }
}
