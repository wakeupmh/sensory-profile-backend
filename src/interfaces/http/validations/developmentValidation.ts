import { z } from 'zod';

const MILESTONE_CATEGORIES = [
  'motor_gross',
  'motor_fine',
  'language',
  'communication',
  'social',
  'cognitive',
  'self_care',
  'other',
] as const;

const MILESTONE_STATUSES = ['not_yet', 'in_progress', 'achieved', 'regressed'] as const;

const COMMUNICATION_ENTRY_TYPES = ['vocabulary', 'aac_usage', 'verbal_speech', 'signs', 'other'] as const;

export const createMilestoneSchema = z.object({
  childId: z.string().uuid(),
  title: z.string().min(1).max(255),
  category: z.enum(MILESTONE_CATEGORIES),
  status: z.enum(MILESTONE_STATUSES).optional(),
  achievedDate: z.string().date().nullable().optional(),
  targetDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.enum(MILESTONE_CATEGORIES).optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
  achievedDate: z.string().date().nullable().optional(),
  targetDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listMilestoneFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  category: z.enum(MILESTONE_CATEGORIES).optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
});

export const createCommunicationLogSchema = z.object({
  childId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  entryType: z.enum(COMMUNICATION_ENTRY_TYPES),
  description: z.string().max(1000).nullable().optional(),
  wordsCount: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateCommunicationLogSchema = z.object({
  occurredAt: z.string().datetime().optional(),
  entryType: z.enum(COMMUNICATION_ENTRY_TYPES).optional(),
  description: z.string().max(1000).nullable().optional(),
  wordsCount: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listCommunicationLogFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  entryType: z.enum(COMMUNICATION_ENTRY_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
