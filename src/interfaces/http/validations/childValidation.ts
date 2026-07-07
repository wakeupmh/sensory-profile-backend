import { z } from 'zod';

export const createChildSchema = z.object({
  name: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other']).optional(),
  nationalIdentity: z.string().optional(),
  otherInfo: z.string().optional(),
  sensoryTriggers: z.string().max(2000).nullable().optional(),
  calmingStrategies: z.string().max(2000).nullable().optional(),
  emergencyContact: z.string().max(500).nullable().optional(),
});

export const updateChildSchema = createChildSchema.partial();

export const profileQuerySchema = z.object({
  periodDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const timelineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
});
