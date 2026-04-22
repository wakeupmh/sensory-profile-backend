import { z } from 'zod';

const nullableInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().optional();

const nullablePositiveNumber = (max: number) =>
  z.number().min(0).max(max).nullable().optional();

const longText = (max = 2000) =>
  z.string().max(max, `Text must not exceed ${max} characters`).default('');

const childSchema = z.object({
  name: z.string().min(1, 'Child name is required').max(100),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  nationalIdentity: z.string().max(50).optional(),
  otherInfo: z.string().max(1000).optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
});

const caregiverSchema = z.object({
  name: z.string().min(1, 'Caregiver name is required').max(100),
  relationship: z.string().min(1, 'Caregiver relationship is required').max(100),
  contact: z.string().max(200).optional(),
});

const queixaSchema = z.object({
  mainComplaint: longText(),
  complaintOnset: longText(500),
  previousTreatments: longText(),
});

const gestationSchema = z.object({
  plannedPregnancy: longText(200),
  deliveryType: z.enum(['vaginal', 'cesarean', 'forceps', 'other', '']).default(''),
  prenatalCareDetails: longText(),
  complications: longText(),
  medicationsDuringPregnancy: longText(),
  gestationalAgeWeeks: nullableInt(0, 45),
  birthWeightGrams: nullablePositiveNumber(10000),
  birthLengthCm: nullablePositiveNumber(100),
  apgar1min: nullableInt(0, 10),
  apgar5min: nullableInt(0, 10),
  neonatalIntercurrences: longText(),
});

const developmentSchema = z.object({
  heldHeadMonths: nullableInt(0, 120),
  sattMonths: nullableInt(0, 120),
  crawledMonths: nullableInt(0, 120),
  walkedMonths: nullableInt(0, 120),
  firstWordsMonths: nullableInt(0, 120),
  firstSentencesMonths: nullableInt(0, 120),
  sphincterControlMonths: nullableInt(0, 120),
  currentMotorObservations: longText(),
  currentLanguageObservations: longText(),
});

const healthSchema = z.object({
  allergies: longText(),
  chronicConditions: longText(),
  currentMedications: longText(),
  pastSurgeries: longText(),
  hospitalizations: longText(),
  recurrentIllnesses: longText(),
  sleepPattern: longText(),
  feedingPattern: longText(),
});

const schoolSchema = z.object({
  attendsSchool: longText(50),
  shift: z.enum(['morning', 'afternoon', 'full', '']).default(''),
  schoolName: longText(200),
  grade: longText(100),
  academicPerformance: longText(),
  socialBehaviorAtSchool: longText(),
  hasSupportTeacher: longText(50),
  supportDetails: longText(),
});

const familySchema = z.object({
  livesWith: longText(),
  parentsMaritalStatus: longText(100),
  siblings: longText(),
  familyHistoryOfDisorders: longText(),
  socioeconomicNotes: longText(),
  additionalNotes: longText(),
});

const clinicalHistorySchema = z.object({
  queixa: queixaSchema,
  gestation: gestationSchema,
  development: developmentSchema,
  health: healthSchema,
  school: schoolSchema,
  family: familySchema,
});

export const createAnamneseSchema = z.object({
  child: childSchema,
  caregiver: caregiverSchema,
  clinicalHistory: clinicalHistorySchema,
});

export const updateAnamneseSchema = createAnamneseSchema;

export type CreateAnamnesePayload = z.infer<typeof createAnamneseSchema>;
export type UpdateAnamnesePayload = z.infer<typeof updateAnamneseSchema>;
