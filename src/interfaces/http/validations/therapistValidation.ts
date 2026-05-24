import { z } from 'zod';

export const THERAPY_TYPES = ['aba', 'ot', 'fonoaudiologia', 'psicologia', 'fisioterapia'] as const;
export const therapyTypeEnum = z.enum(THERAPY_TYPES);

export const createTherapistSchema = z.object({
  name: z.string().min(1).max(255),
  specialty: therapyTypeEnum,
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateTherapistSchema = createTherapistSchema.partial();
