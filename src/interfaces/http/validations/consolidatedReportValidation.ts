import { z } from 'zod';

export const getSummaryQuerySchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.coerce.number().int().min(7).max(365).default(90),
});

export const createShareSchema = z.object({
  childId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

export const listSharesQuerySchema = z.object({
  childId: z.string().uuid(),
});

export const generateAISummarySchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.number().int().min(7).max(365).default(90),
});
