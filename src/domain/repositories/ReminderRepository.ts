import { Reminder, ReminderStatus } from '../entities/Reminder';

export interface ReminderCreateInput {
  id: string;
  userId: string;
  childId: string;
  title: string;
  dueAt: Date;
  status?: ReminderStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  notes?: string | null;
}

export interface ReminderUpdateInput {
  title?: string;
  dueAt?: Date;
  status?: ReminderStatus;
  notes?: string | null;
}

export interface ReminderFilters {
  childId?: string;
  status?: ReminderStatus;
}

export interface ReminderRepository {
  save(input: ReminderCreateInput): Promise<Reminder>;
  findById(id: string, userId: string): Promise<Reminder | null>;
  findAllByUser(userId: string, filters: ReminderFilters): Promise<Reminder[]>;
  update(id: string, userId: string, input: ReminderUpdateInput): Promise<Reminder | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
