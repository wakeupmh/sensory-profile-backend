import { z } from 'zod';

export { LOG_TYPES } from '../../../domain/entities/DailyLog';
import { LOG_TYPES } from '../../../domain/entities/DailyLog';

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

/**
 * Formatos dos demais tipos de registro. Só o `abc` era validado; os outros
 * quatro aceitavam qualquer coisa, o que passou a importar quando a tela do
 * relato do dia permitiu ao cuidador **editar** os valores sugeridos pela IA
 * antes de confirmar — um sono de qualidade 9, ou um humor nível 42, entrava
 * no histórico clínico sem ninguém reclamar.
 *
 * `passthrough` e tudo opcional de propósito: isto valida o VALOR de campos
 * conhecidos, não torna nada obrigatório nem descarta campos que algum
 * cliente já mande. Um registro que era aceito antes continua sendo aceito;
 * o que deixa de passar é um valor fora da faixa.
 */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const shortText = z.string().trim().max(200);

const moodDataSchema = z.object({
  level: z.number().int().min(1).max(5).optional(),
  tags: z.array(shortText).max(20).optional(),
}).passthrough();

const sleepDataSchema = z.object({
  bedtime: z.string().regex(HHMM, 'Horário deve estar no formato HH:MM').optional(),
  waketime: z.string().regex(HHMM, 'Horário deve estar no formato HH:MM').optional(),
  wakings: z.number().int().min(0).max(50).optional(),
  quality: z.number().int().min(1).max(3).optional(),
}).passthrough();

const foodDataSchema = z.object({
  meal: z.enum(['cafe', 'almoco', 'jantar', 'lanche']).optional(),
  accepted: z.array(shortText).max(50).optional(),
  refused: z.array(shortText).max(50).optional(),
}).passthrough();

const toiletingDataSchema = z.object({
  type: z.enum(['urina', 'fezes', 'ambos']).optional(),
  independent: z.boolean().optional(),
}).passthrough();

const DATA_SCHEMA_BY_LOG_TYPE: Record<string, z.ZodTypeAny> = {
  abc: abcDataSchema,
  mood: moodDataSchema,
  sleep: sleepDataSchema,
  food: foodDataSchema,
  toileting: toiletingDataSchema,
};

function validateDataForLogType(logType: string, data: unknown, ctx: z.RefinementCtx) {
  const schema = DATA_SCHEMA_BY_LOG_TYPE[logType];
  if (!schema) return;
  const result = schema.safeParse(data);
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

