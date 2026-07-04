import { z } from 'zod';

export const GOAL_DOMAINS = [
  'comunicacao',
  'social',
  'motor',
  'autocuidado',
  'academico',
  'comportamental',
  'outro',
] as const;
export const goalDomainEnum = z.enum(GOAL_DOMAINS);

export const GOAL_STATUSES = ['active', 'achieved', 'paused', 'discontinued'] as const;
export const goalStatusEnum = z.enum(GOAL_STATUSES);

export const createGoalSchema = z.object({
  childId: z.string().uuid(),
  domain: goalDomainEnum,
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  masteryCriteria: z.string().max(1000).nullable().optional(),
  baselineValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  status: goalStatusEnum.optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sourceEducationPlanId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateGoalSchema = createGoalSchema.partial().omit({ childId: true, sourceEducationPlanId: true });

export const listGoalFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  domain: goalDomainEnum.optional(),
  status: goalStatusEnum.optional(),
});

export const createGoalProgressSchema = z.object({
  recordedAt: z.string().datetime(),
  value: z.number().nullable().optional(),
  statusSnapshot: goalStatusEnum.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  therapySessionId: z.string().uuid().nullable().optional(),
});
