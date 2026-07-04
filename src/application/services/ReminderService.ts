import { Reminder, ReminderStatus } from '../../domain/entities/Reminder';
import {
  ReminderRepository,
  ReminderCreateInput,
  ReminderUpdateInput,
  ReminderFilters,
} from '../../domain/repositories/ReminderRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateReminderPayload {
  childId: string;
  title: string;
  dueAt: Date;
  status?: ReminderStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  notes?: string | null;
}

export class ReminderService extends BaseDomainService<
  Reminder,
  ReminderCreateInput,
  ReminderUpdateInput,
  CreateReminderPayload,
  ReminderUpdateInput,
  ReminderFilters
> {
  constructor(repo: ReminderRepository) {
    super(repo, 'Lembrete não encontrado');
  }
}
