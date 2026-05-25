import { z } from 'zod';

const EDUCATION_PLAN_TYPES = ['pei', 'pei_simplificado', 'adaptacao_curricular', 'plano_aee', 'outro'] as const;
const SCHOOL_COMM_TYPES = ['reuniao', 'bilhete', 'email', 'telefone', 'incidente', 'relatorio', 'outro'] as const;

export const createEducationPlanSchema = z.object({
  childId: z.string().uuid(),
  schoolName: z.string().min(1).max(255),
  academicYear: z.string().min(1).max(20),
  planType: z.enum(EDUCATION_PLAN_TYPES),
  startDate: z.string().date(),
  reviewDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  goals: z.string().max(5000).nullable().optional(),
  accommodations: z.string().max(5000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateEducationPlanSchema = createEducationPlanSchema.partial().omit({ childId: true });

export const listEducationPlanFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  academicYear: z.string().optional(),
  planType: z.enum(EDUCATION_PLAN_TYPES).optional(),
});

export const createSchoolCommSchema = z.object({
  childId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  commType: z.enum(SCHOOL_COMM_TYPES),
  subject: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  attendees: z.string().max(500).nullable().optional(),
  followUpDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateSchoolCommSchema = createSchoolCommSchema.partial().omit({ childId: true });

export const listSchoolCommFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  commType: z.enum(SCHOOL_COMM_TYPES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
