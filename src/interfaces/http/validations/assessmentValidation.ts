import { z } from 'zod';
import { ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import { DEFAULT_INSTRUMENT_ID } from '../../../domain/entities/Assessment';
import { getInstrument } from '../../../instruments';
import { calculateAgeUTC } from '../../../infrastructure/utils/date';

// Instrument whose 3-14 age and required-response checks run here; its raw
// scores are computed from responses in AssessmentService.
const LEGACY_INSTRUMENT_ID = DEFAULT_INSTRUMENT_ID;

export const isLegacyInstrument = (instrumentId?: string): boolean =>
  (instrumentId ?? LEGACY_INSTRUMENT_ID) === LEGACY_INSTRUMENT_ID;

const instrumentIdSchema = z
  .string()
  .min(1, 'Instrument ID cannot be empty')
  .max(100, 'Instrument ID must not exceed 100 characters')
  .regex(/^[a-z0-9-]+$/i, 'Instrument ID contains invalid characters')
  .default(LEGACY_INSTRUMENT_ID);


// Open response string — per-instrument value validation is done via
// superRefine on the responses array (see assessmentSchema / createAssessmentSchema).
// Legacy SP-2 values are still checked there for backward compatibility.
const SP2_VALID_RESPONSES = new Set([
  'quase sempre', 'frequentemente', 'metade do tempo', 'ocasionalmente', 'quase nunca', 'não se aplica',
  'almost always', 'frequently', 'half the time', 'occasionally', 'almost never', 'does not apply',
  'always', 'rarely', 'never',
]);

// Nome de pessoa: letras de qualquer alfabeto (com acento), espaço, apóstrofo,
// hífen e ponto — "Dra. Júlia", "José da S. Lima", "Łucja" são nomes reais.
const personName = (label: string) => z.string()
  .trim()
  .min(1, `${label} é obrigatório`)
  .max(100, `${label} deve ter no máximo 100 caracteres`)
  .regex(/^[\p{L}\p{M}\s'.-]+$/u, `${label} só pode ter letras, espaços, apóstrofo, hífen e ponto`);

// Campo opcional: em branco quer dizer "não informado", não um valor inválido.
const optionalText = (max: number, label: string) => z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().max(max, `${label} deve ter no máximo ${max} caracteres`).optional(),
);

// O que o formulário envia, mais os valores antigos, que seguem válidos para o
// que já está gravado.
export const CAREGIVER_RELATIONSHIPS = [
  'mother', 'father', 'grandparent', 'sibling',
  'parent', 'guardian', 'teacher', 'therapist', 'caregiver', 'other',
] as const;

const childSchema = z.object({
  /** Criança já cadastrada: a avaliação fica ligada a ela em vez de criar outra. */
  id: z.string().uuid('Criança inválida').optional(),
  name: personName('Nome da criança'),

  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato AAAA-MM-DD')
    .refine((d) => {
      const [y, m, day] = d.split('-').map(Number);
      const parsed = new Date(`${d}T12:00:00Z`);
      return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m && parsed.getUTCDate() === day;
    }, 'Data inválida')
    .refine((date) => {
      return new Date(`${date}T12:00:00Z`) <= new Date();
    }, 'Data de nascimento não pode ser futura'),

  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gênero deve ser masculino, feminino ou outro' })
  }).optional(),

  nationalIdentity: optionalText(50, 'Documento'),
  otherInfo: optionalText(1000, 'Informações adicionais'),
}).strict();

const examinerSchema = z.object({
  name: personName('Nome do examinador'),
  profession: z.string()
    .trim()
    .min(1, 'Profissão é obrigatória')
    .max(100, 'Profissão deve ter no máximo 100 caracteres'),
  contact: optionalText(200, 'Contato'),
}).strict();

const caregiverSchema = z.object({
  name: personName('Nome do responsável'),
  relationship: z.enum(CAREGIVER_RELATIONSHIPS, {
    errorMap: () => ({ message: 'Parentesco inválido' }),
  }),
  contact: optionalText(200, 'Contato'),
}).strict();

// Individual response item schema — response value is an open string.
// Cross-instrument value validation happens in the responses array superRefine.
const responseItemSchema = z.object({
  itemId: z.number()
    .int('Item ID must be an integer')
    .positive('Item ID must be a positive integer'),

  response: z.string().min(1, 'Response value cannot be empty'),
}).strict();

/**
 * Build a superRefine validator for a responses array given the instrumentId
 * from the parent payload.  For legacy instruments the SP-2 allow-list is
 * enforced; for non-legacy instruments the instrument's own scale.options are
 * checked (if registered); unknown instruments fall through without error.
 */
function buildResponsesRefine(instrumentId: string) {
  return (
    responses: Array<{ itemId: number; response: string }>,
    ctx: z.RefinementCtx,
  ) => {
    const instrument = getInstrument(instrumentId);
    if (instrument && !instrument.legacy) {
      // Non-legacy instrument registered in the registry — validate against its scale,
      // narrowing to the section's allowedValues when the item belongs to a section
      // that restricts the response set (e.g. ATEC Sociability accepts 0-2, not 0-3).
      const scaleValues = instrument.scale.options.map((o) => o.value);
      responses.forEach((r, idx) => {
        const section = instrument.sections.find((s) => s.itemIds.includes(r.itemId));
        const validValues = section?.allowedValues ?? scaleValues;
        if (!validValues.includes(r.response)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [idx, 'response'],
            message: `Invalid response value "${r.response}" for instrument "${instrumentId}"${section ? ` section "${section.key}"` : ''}. Valid values: ${validValues.join(', ')}`,
          });
        }
      });
    } else if (instrument?.legacy || !instrument) {
      // Legacy SP-2 instruments (or unknown instruments) — use the SP-2 allow-list.
      responses.forEach((r, idx) => {
        if (!SP2_VALID_RESPONSES.has(r.response)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [idx, 'response'],
            message: `Response must be one of: quase sempre, frequentemente, metade do tempo, ocasionalmente, quase nunca, não se aplica`,
          });
        }
      });
    }
  };
}

// Section comment validation.
// Section key is an open string so non-SP-2 instruments can send their own
// section keys without being rejected at the Zod layer.  Instrument-level key
// validation (against instrument.sections[].key) is the responsibility of the
// service layer.
const sectionCommentSchema = z.object({
  section: z.string().min(1, 'Section key cannot be empty'),
  comments: z.string()
    .min(1, 'Comments cannot be empty if provided')
    .max(2000, 'Comments must not exceed 2000 characters')
}).strict();

// Raw scores validation with expected ranges based on official form
const rawScoresSchema = z.object({
  auditoryProcessing: z.number().int().min(8).max(40),           // 8 items × 1-5
  visualProcessing: z.number().int().min(6).max(30),             // 6 items × 1-5 (excluding 15)
  tactileProcessing: z.number().int().min(11).max(55),           // 11 items × 1-5
  movementProcessing: z.number().int().min(8).max(40),           // 8 items × 1-5
  bodyPositionProcessing: z.number().int().min(8).max(40),       // 8 items × 1-5
  oralSensitivityProcessing: z.number().int().min(10).max(50),   // 10 items × 1-5
  behavioralResponses: z.number().int().min(9).max(45),          // 9 items × 1-5 (CONDUTA)
  socialEmotionalResponses: z.number().int().min(14).max(70),    // 14 items × 1-5 (SOCIOEMOCIONAL)
  attentionResponses: z.number().int().min(10).max(50)           // 10 items × 1-5 (excluding 86)
}).strict();

// Main assessment schema
export const assessmentSchema = z.object({
  instrumentId: instrumentIdSchema,
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  responses: z.array(responseItemSchema)
    .min(1, 'At least one response is required')
    .max(200, 'Cannot have more than 200 responses')
    .refine((responses) => {
      // Check for duplicate item IDs
      const itemIds = responses.map(r => r.itemId);
      const uniqueIds = new Set(itemIds);
      return uniqueIds.size === itemIds.length;
    }, 'Duplicate item IDs are not allowed'),

  // rawScores are only validated against legacy ranges for the Criança 3-14
  // instrument; for other instruments any provided scores are accepted and
  // scoring is deferred to the frontend.
  rawScores: rawScoresSchema.optional(),

  sectionComments: z.array(sectionCommentSchema)
    .max(20, 'Cannot have more than 20 section comments')
    .optional()
}).strict().superRefine((data, ctx) => {
  buildResponsesRefine(data.instrumentId)(data.responses, ctx);
});

// Simplified schema for creating assessments (auto-calculate scores)
export const createAssessmentSchema = z.object({
  instrumentId: instrumentIdSchema,
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  responses: z.array(responseItemSchema)
    .min(1, 'At least one response is required')
    .max(200, 'Cannot have more than 200 responses')
    .refine((responses) => {
      const itemIds = responses.map(r => r.itemId);
      const uniqueIds = new Set(itemIds);
      return uniqueIds.size === itemIds.length;
    }, 'Duplicate item IDs are not allowed'),

  sectionComments: z.array(sectionCommentSchema)
    .max(20, 'Cannot have more than 20 section comments')
    .optional(),

  parentAssessmentId: z.string().uuid('Parent assessment ID must be a valid UUID').optional(),
}).strict().superRefine((data, ctx) => {
  buildResponsesRefine(data.instrumentId)(data.responses, ctx);
});

// Update assessment schema (partial updates allowed).
// Built from the raw object shape (without the superRefine effect) so that
// .partial()/.strict() are available. Response-value validation during updates
// is handled in the service layer.
const assessmentObjectShape = z.object({
  instrumentId: instrumentIdSchema,
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  responses: z.array(responseItemSchema)
    .min(1, 'At least one response is required')
    .max(200, 'Cannot have more than 200 responses')
    .refine((responses) => {
      const itemIds = responses.map(r => r.itemId);
      const uniqueIds = new Set(itemIds);
      return uniqueIds.size === itemIds.length;
    }, 'Duplicate item IDs are not allowed'),
  rawScores: rawScoresSchema.optional(),
  sectionComments: z.array(sectionCommentSchema)
    .max(20, 'Cannot have more than 20 section comments')
    .optional(),
});
export const updateAssessmentSchema = assessmentObjectShape.partial().strict().superRefine((data, ctx) => {
  if (data.responses && data.responses.length > 0) {
    const instrumentId = data.instrumentId ?? LEGACY_INSTRUMENT_ID;
    buildResponsesRefine(instrumentId)(data.responses, ctx);
  }
});

// Query parameter validation
export const assessmentQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .refine(n => n > 0, 'Page must be greater than 0')
    .optional(),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .optional(),
  
  childId: z.string()
    .uuid('Child ID must be a valid UUID')
    .optional(),
  
  examinerId: z.string()
    .uuid('Examiner ID must be a valid UUID')
    .optional(),
  
  dateFrom: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date from must be in YYYY-MM-DD format')
    .refine((d) => {
      const [y, m, day] = d.split('-').map(Number);
      const parsed = new Date(`${d}T12:00:00Z`);
      return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m && parsed.getUTCDate() === day;
    }, 'Data inválida')
    .optional(),

  dateTo: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date to must be in YYYY-MM-DD format')
    .refine((d) => {
      const [y, m, day] = d.split('-').map(Number);
      const parsed = new Date(`${d}T12:00:00Z`);
      return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m && parsed.getUTCDate() === day;
    }, 'Data inválida')
    .optional()
}).strict().refine((data) => {
  if (data.dateFrom && data.dateTo) {
    return new Date(data.dateFrom) <= new Date(data.dateTo);
  }
  return true;
}, 'Date from must be before or equal to date to');

// Type exports
export type AssessmentPayload = z.infer<typeof assessmentSchema>;
export type CreateAssessmentPayload = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentPayload = z.infer<typeof updateAssessmentSchema>;
export type AssessmentQuery = z.infer<typeof assessmentQuerySchema>;


// Validation helper functions.
// The 3-14 age range only applies to the legacy Criança 3-14 instrument.
// Other instruments (e.g. Criança Pequena 7-36 meses) accept any non-future
// birth date and defer age-appropriateness to the frontend.
export const validateChildAge = (birthDate: string, instrumentId?: string): number => {
  const birth = new Date(birthDate + 'T12:00:00Z');
  const today = new Date();
  const age = calculateAgeUTC(birthDate);

  if (birth > today) {
    throw new ValidationError('Birth date cannot be in the future');
  }

  if (isLegacyInstrument(instrumentId) && (age < 3 || age > 14)) {
    throw new ValidationError(`Child age ${age} is outside the valid range (3-14 years)`);
  }

  return age;
};

export const validateRequiredResponses = (responses: Array<{ itemId: number, response: string }>, instrumentId?: string): void => {
  // Section minimums below are specific to the Criança 3-14 form and
  // meaningless for other instruments (which have their own item IDs).
  if (!isLegacyInstrument(instrumentId)) {
    return;
  }

  const itemCounts = {
    auditoryProcessing: 0,
    visualProcessing: 0,
    tactileProcessing: 0,
    movementProcessing: 0,
    bodyPositionProcessing: 0,
    oralSensitivityProcessing: 0,
    behavioralResponses: 0,
    socialEmotionalResponses: 0,
    attentionResponses: 0
  };
  
  // Count items per section based on 86-item structure
  responses.forEach(response => {
    if (response.itemId >= 1 && response.itemId <= 8) itemCounts.auditoryProcessing++;
    else if (response.itemId >= 9 && response.itemId <= 14) itemCounts.visualProcessing++; // excluding 15
    else if (response.itemId >= 16 && response.itemId <= 26) itemCounts.tactileProcessing++;
    else if (response.itemId >= 27 && response.itemId <= 34) itemCounts.movementProcessing++;
    else if (response.itemId >= 35 && response.itemId <= 42) itemCounts.bodyPositionProcessing++;
    else if (response.itemId >= 43 && response.itemId <= 52) itemCounts.oralSensitivityProcessing++;
    else if (response.itemId >= 53 && response.itemId <= 61) itemCounts.behavioralResponses++;
    else if (response.itemId >= 62 && response.itemId <= 75) itemCounts.socialEmotionalResponses++;
    else if (response.itemId >= 76 && response.itemId <= 85) itemCounts.attentionResponses++; // excluding 86
  });
  
  // Check minimum requirements (at least 50% of items per section)
  const errors: string[] = [];
  if (itemCounts.auditoryProcessing < 4) errors.push('Auditory Processing section needs at least 4 responses');
  if (itemCounts.visualProcessing < 3) errors.push('Visual Processing section needs at least 3 responses');
  if (itemCounts.tactileProcessing < 6) errors.push('Tactile Processing section needs at least 6 responses');
  if (itemCounts.movementProcessing < 4) errors.push('Movement Processing section needs at least 4 responses');
  if (itemCounts.bodyPositionProcessing < 4) errors.push('Body Position Processing section needs at least 4 responses');
  if (itemCounts.oralSensitivityProcessing < 5) errors.push('Oral Sensitivity Processing section needs at least 5 responses');
  if (itemCounts.behavioralResponses < 5) errors.push('Behavioral Responses section needs at least 5 responses');
  if (itemCounts.socialEmotionalResponses < 7) errors.push('Social Emotional Responses section needs at least 7 responses');
  if (itemCounts.attentionResponses < 5) errors.push('Attention Responses section needs at least 5 responses');
  
  if (errors.length > 0) {
    throw new ValidationError('Insufficient responses for valid assessment', { errors });
  }
};
