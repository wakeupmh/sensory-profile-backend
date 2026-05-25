import { z } from 'zod';
import { ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

const FORM_TYPES = ['sensory_assessment', 'anamnese'] as const;

export const upsertDraftSchema = z.object({
  payload: z.record(z.unknown()).default({}).refine(
    (val) => JSON.stringify(val).length <= 100_000,
    { message: 'Draft payload exceeds 100KB limit' }
  ),
  currentStep: z.number().int().min(0).default(0),
  instrumentId: z.string().nullable().optional(),
});

export function assertValidFormType(
  value: string | undefined
): asserts value is (typeof FORM_TYPES)[number] {
  if (!value || !FORM_TYPES.includes(value as (typeof FORM_TYPES)[number])) {
    throw new ValidationError(`Invalid form_type: must be one of ${FORM_TYPES.join(', ')}`);
  }
}
