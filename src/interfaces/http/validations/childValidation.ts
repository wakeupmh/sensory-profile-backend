import { z } from 'zod';

export const createChildSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other']).optional(),
  nationalIdentity: z.string().optional(),
  otherInfo: z.string().optional(),
});

export const updateChildSchema = createChildSchema.partial();
