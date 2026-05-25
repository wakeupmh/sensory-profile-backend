import { z } from 'zod';

export const createMedicationSchema = z.object({
  childId: z.string().uuid(),
  name: z.string().min(1).max(255),
  dosage: z.string().max(100).nullable().optional(),
  frequency: z.string().max(100).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  prescribingDoctor: z.string().max(255).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial().omit({ childId: true });

export const listMedicationFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

export const createComorbiditySchema = z.object({
  childId: z.string().uuid(),
  conditionName: z.string().min(1).max(255),
  icdCode: z.string().max(20).nullable().optional(),
  diagnosisDate: z.string().date().nullable().optional(),
  diagnosingDoctor: z.string().max(255).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateComorbiditySchema = createComorbiditySchema.partial().omit({ childId: true });

export const listComorbidityFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
});

export const createAppointmentSchema = z.object({
  childId: z.string().uuid(),
  doctorName: z.string().max(255).nullable().optional(),
  specialty: z.string().max(100).nullable().optional(),
  clinicName: z.string().max(255).nullable().optional(),
  occurredAt: z.string().datetime(),
  summary: z.string().max(2000).nullable().optional(),
  followUpDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().omit({ childId: true });

export const listAppointmentFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
