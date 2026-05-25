import { z } from 'zod';

export const LOG_TYPES = ['abc', 'mood', 'sleep', 'food', 'toileting'] as const;
export const logTypeEnum = z.enum(LOG_TYPES);

export const createLogSchema = z.object({
  childId: z.string().uuid(),
  logType: logTypeEnum,
  occurredAt: z.string().datetime(),
  data: z.record(z.unknown()).default({}),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateLogSchema = createLogSchema.partial().omit({ childId: true });

export const listFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  logType: logTypeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
