import { z } from 'zod';

export const REMINDER_STATUSES = ['pending', 'done', 'dismissed'] as const;
export const reminderStatusEnum = z.enum(REMINDER_STATUSES);

export const createReminderSchema = z.object({
  childId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  dueAt: z.string().datetime(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  dueAt: z.string().datetime().optional(),
  status: reminderStatusEnum.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listReminderFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  status: reminderStatusEnum.optional(),
});

export const upcomingRemindersQuerySchema = z.object({
  childId: z.string().uuid().optional(),
  days: z.coerce.number().int().positive().max(365).default(14),
});
