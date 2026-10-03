import { z } from 'zod';

// Só o formato não basta: '2020-13-45' passa na regex e o Postgres responde
// "date/time field value out of range" — um 500 para um erro de digitação.
const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato AAAA-MM-DD')
  .refine((d) => {
    const [y, m, day] = d.split('-').map(Number);
    const parsed = new Date(`${d}T12:00:00Z`);
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() + 1 === m && parsed.getUTCDate() === day;
  }, 'Data inválida')
  .refine((d) => new Date(`${d}T12:00:00Z`) <= new Date(), 'Data de nascimento não pode ser futura');

const isoInstant = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');

export const createChildSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
  birthDate: birthDateSchema,
  gender: z.enum(['male', 'female', 'other']).optional(),
  nationalIdentity: z.string().max(50, 'Documento deve ter no máximo 50 caracteres').optional(),
  otherInfo: z.string().max(1000, 'Informações adicionais devem ter no máximo 1000 caracteres').optional(),
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
  from: isoInstant.optional(),
  to: isoInstant.optional(),
});
