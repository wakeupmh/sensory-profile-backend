import { z } from 'zod';

export const getSummaryQuerySchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.coerce.number().int().min(7).max(365).default(90),
});

export const createShareSchema = z.object({
  childId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
  periodDays: z.number().int().min(7).max(365).default(90),
});

export const listSharesQuerySchema = z.object({
  childId: z.string().uuid(),
});

export const generateAISummarySchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.number().int().min(7).max(365).default(90),
});

export const listAiSummariesQuerySchema = z.object({
  childId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const askAiQuestionSchema = z.object({
  childId: z.string().uuid(),
  question: z.string().trim().min(3, 'Pergunta muito curta').max(500, 'Pergunta muito longa'),
  periodDays: z.number().int().min(7).max(365).default(90),
});

// A consultation brief typically covers what's happened since the last
// appointment (weeks to a few months), so the default window is shorter
// than the quarterly summary's 90 days.
export const consultationBriefSchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.number().int().min(7).max(365).default(60),
});
