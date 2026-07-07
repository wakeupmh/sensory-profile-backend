import { z } from 'zod';

export const LOG_TYPES = ['abc', 'mood', 'sleep', 'food', 'toileting'] as const;
export const logTypeEnum = z.enum(LOG_TYPES);

// Canonical shape for ABC (Antecedent-Behavior-Consequence) entries. Enforced
// only when logType === 'abc' so the other log types keep their free-form
// `data` payload; this lets BehaviorInsightsService rely on the field names
// when aggregating.
const abcDataSchema = z.object({
  antecedent: z.string().trim().min(1, 'Antecedente é obrigatório').max(500),
  behavior: z.string().trim().min(1, 'Comportamento é obrigatório').max(500),
  consequence: z.string().trim().min(1, 'Consequência é obrigatória').max(500),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  location: z.string().trim().max(200).optional(),
});

const genericDataSchema = z.record(z.unknown());

function validateDataForLogType(logType: string, data: unknown, ctx: z.RefinementCtx) {
  if (logType !== 'abc') return;
  const result = abcDataSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        ...issue,
        path: ['data', ...issue.path],
      });
    }
  }
}

export const createLogSchema = z
  .object({
    childId: z.string().uuid(),
    logType: logTypeEnum,
    occurredAt: z.string().datetime(),
    data: genericDataSchema.default({}),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((val, ctx) => validateDataForLogType(val.logType, val.data, ctx));

export const updateLogSchema = z
  .object({
    logType: logTypeEnum.optional(),
    occurredAt: z.string().datetime().optional(),
    data: genericDataSchema.optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.logType && val.data) validateDataForLogType(val.logType, val.data, ctx);
  });

export const listFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  logType: logTypeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  // Capped at 1000 (not the usual 100) so a caller fetching a whole month
  // of logs in one page — e.g. a monthly recap view — doesn't get silently
  // truncated to the 100 most recent entries.
  limit: z.coerce.number().int().positive().max(1000).default(20),
});

export const behaviorInsightsQuerySchema = z.object({
  childId: z.string().uuid(),
  days: z.coerce.number().int().positive().max(365).default(30),
});

