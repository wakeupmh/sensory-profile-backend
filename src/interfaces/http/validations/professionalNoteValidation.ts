import { z } from 'zod';

export const createProfessionalNoteSchema = z.object({
  resourceType: z.string().max(50).nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1, 'Conteúdo obrigatório').max(4000, 'Nota muito longa'),
});

export const updateProfessionalNoteSchema = z.object({
  content: z.string().trim().min(1, 'Conteúdo obrigatório').max(4000, 'Nota muito longa'),
});

export const listAccessLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
