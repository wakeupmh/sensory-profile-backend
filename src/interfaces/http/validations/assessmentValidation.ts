import { z } from 'zod';

const responseEnum = z.enum(['almost_always', 'frequently', 'half_time', 'occasionally', 'almost_never', 'not_applied']);

const childSchema = z.object({
  name: z.string().min(1, 'Nome da criança é obrigatório'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  nationalIdentity: z.string().optional(),
  otherInfo: z.string().optional(),
  age: z.number().int().positive().optional()
});

const examinerSchema = z.object({
  name: z.string().min(1, 'Nome do examinador é obrigatório'),
  profession: z.string().min(1, 'Profissão do examinador é obrigatória'),
  contact: z.string().optional()
});

const caregiverSchema = z.object({
  name: z.string().min(1, 'Nome do cuidador é obrigatório'),
  relationship: z.string().min(1, 'Relacionamento com a criança é obrigatório'),
  contact: z.string().optional()
});

const itemSchema = z.object({
  id: z.number().int().positive(),
  quadrant: z.enum(['OB', 'SN', 'EV', 'EX']),
  description: z.string(),
  response: responseEnum
});

const sectionSchema = z.object({
  items: z.array(itemSchema),
  rawScore: z.number().int().nonnegative(),
  comments: z.string().optional()
});

export const assessmentSchema = z.object({
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  auditoryProcessing: sectionSchema,
  visualProcessing: sectionSchema,
  tactileProcessing: sectionSchema,
  movementProcessing: sectionSchema,
  bodyPositionProcessing: sectionSchema,
  oralSensitivityProcessing: sectionSchema,
  socialEmotionalResponses: sectionSchema,
  attentionResponses: sectionSchema
});

export type AssessmentPayload = z.infer<typeof assessmentSchema>;

export const transformPayloadForService = (payload: AssessmentPayload) => {
  const responses = [
    ...payload.auditoryProcessing.items,
    ...payload.visualProcessing.items,
    ...payload.tactileProcessing.items,
    ...payload.movementProcessing.items,
    ...payload.bodyPositionProcessing.items,
    ...payload.oralSensitivityProcessing.items,
    ...payload.socialEmotionalResponses.items,
    ...payload.attentionResponses.items
  ].map(item => ({
    itemId: item.id,
    response: item.response
  }));

  const sectionComments = [
    { section: 'auditoryProcessing', comments: payload.auditoryProcessing.comments },
    { section: 'visualProcessing', comments: payload.visualProcessing.comments },
    { section: 'tactileProcessing', comments: payload.tactileProcessing.comments },
    { section: 'movementProcessing', comments: payload.movementProcessing.comments },
    { section: 'bodyPositionProcessing', comments: payload.bodyPositionProcessing.comments },
    { section: 'oralSensitivityProcessing', comments: payload.oralSensitivityProcessing.comments },
    { section: 'socialEmotionalResponses', comments: payload.socialEmotionalResponses.comments },
    { section: 'attentionResponses', comments: payload.attentionResponses.comments }
  ].filter(comment => comment.comments && comment.comments.trim() !== '');

  return {
    child: payload.child,
    examiner: payload.examiner,
    caregiver: payload.caregiver,
    responses,
    sectionComments,
    rawScores: {
      auditoryProcessing: payload.auditoryProcessing.rawScore,
      visualProcessing: payload.visualProcessing.rawScore,
      tactileProcessing: payload.tactileProcessing.rawScore,
      movementProcessing: payload.movementProcessing.rawScore,
      bodyPositionProcessing: payload.bodyPositionProcessing.rawScore,
      oralSensitivityProcessing: payload.oralSensitivityProcessing.rawScore,
      socialEmotionalResponses: payload.socialEmotionalResponses.rawScore,
      attentionResponses: payload.attentionResponses.rawScore
    }
  };
};
