import { z } from 'zod';
import { THERAPY_TYPES, therapyTypeEnum } from './therapistValidation';

export { THERAPY_TYPES, therapyTypeEnum };

export const createSessionSchema = z.object({
  childId: z.string().uuid(),
  therapistId: z.string().uuid().nullable().optional(),
  therapyType: therapyTypeEnum,
  occurredAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(480).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateSessionSchema = createSessionSchema.partial().omit({ childId: true });

export const listSessionFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  therapyType: therapyTypeEnum.optional(),
  therapistId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
