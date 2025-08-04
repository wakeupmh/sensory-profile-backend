import { z } from 'zod';
import { validateItemId, getExpectedScoreRanges } from '../../../infrastructure/utils/scoring/scoringService';
import { ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

// Valid response values based on official Sensory Profile 2 form
const responseEnum = z.enum([
  // Official Portuguese responses
  'quase sempre', 'frequentemente', 'metade do tempo', 'ocasionalmente', 'quase nunca', 'não se aplica',
  // English equivalents
  'almost always', 'frequently', 'half the time', 'occasionally', 'almost never', 'does not apply',
  // Legacy support (deprecated)
  'always', 'rarely', 'never'
], {
  errorMap: () => ({ message: 'Response must be one of: quase sempre, frequentemente, metade do tempo, ocasionalmente, quase nunca, não se aplica' })
});

// Enhanced child validation
const childSchema = z.object({
  name: z.string()
    .min(1, 'Child name is required')
    .max(100, 'Child name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Child name contains invalid characters'),
  
  birthDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 3 && age <= 14;
    }, 'Child must be between 3 and 14 years old'),
  
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' })
  }).optional(),
  
  nationalIdentity: z.string()
    .min(1, 'National identity cannot be empty if provided')
    .max(50, 'National identity must not exceed 50 characters')
    .optional(),
  
  otherInfo: z.string()
    .max(1000, 'Additional information must not exceed 1000 characters')
    .optional()
}).strict();

// Enhanced examiner validation
const examinerSchema = z.object({
  name: z.string()
    .min(1, 'Examiner name is required')
    .max(100, 'Examiner name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Examiner name contains invalid characters'),
  
  profession: z.string()
    .min(1, 'Profession is required')
    .max(100, 'Profession must not exceed 100 characters'),
  
  contact: z.string()
    .max(200, 'Contact information must not exceed 200 characters')
    .optional()
}).strict();

// Enhanced caregiver validation
const caregiverSchema = z.object({
  name: z.string()
    .min(1, 'Caregiver name is required')
    .max(100, 'Caregiver name must not exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Caregiver name contains invalid characters'),
  
  relationship: z.string()
    .min(1, 'Relationship is required')
    .max(50, 'Relationship must not exceed 50 characters')
    .refine((rel) => {
      const validRelationships = ['parent', 'guardian', 'teacher', 'therapist', 'caregiver', 'other'];
      return validRelationships.includes(rel.toLowerCase()) || rel.length > 0;
    }, 'Invalid relationship type'),
  
  contact: z.string()
    .max(200, 'Contact information must not exceed 200 characters')
    .optional()
}).strict();

// Individual response validation
const responseSchema = z.object({
  itemId: z.number()
    .int('Item ID must be an integer')
    .refine(validateItemId, 'Item ID must be between 1 and 86'),
  
  response: responseEnum
}).strict();

// Section comment validation
const sectionCommentSchema = z.object({
  section: z.enum([
    'auditoryProcessing', 'visualProcessing', 'tactileProcessing',
    'movementProcessing', 'bodyPositionProcessing', 'oralSensitivityProcessing',
    'behavioralResponses', 'socialEmotionalResponses', 'attentionResponses'
  ]),
  comments: z.string()
    .min(1, 'Comments cannot be empty if provided')
    .max(2000, 'Comments must not exceed 2000 characters')
}).strict();

// Raw scores validation with expected ranges based on official form
const rawScoresSchema = z.object({
  auditoryProcessing: z.number().int().min(8).max(40),           // 8 items × 1-5
  visualProcessing: z.number().int().min(6).max(30),             // 6 items × 1-5 (excluding 15)
  tactileProcessing: z.number().int().min(11).max(55),           // 11 items × 1-5
  movementProcessing: z.number().int().min(8).max(40),           // 8 items × 1-5
  bodyPositionProcessing: z.number().int().min(8).max(40),       // 8 items × 1-5
  oralSensitivityProcessing: z.number().int().min(10).max(50),   // 10 items × 1-5
  behavioralResponses: z.number().int().min(9).max(45),          // 9 items × 1-5 (CONDUTA)
  socialEmotionalResponses: z.number().int().min(14).max(70),    // 14 items × 1-5 (SOCIOEMOCIONAL)
  attentionResponses: z.number().int().min(10).max(50)           // 10 items × 1-5 (excluding 86)
}).strict();

// Main assessment schema
export const assessmentSchema = z.object({
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  responses: z.array(responseSchema)
    .min(1, 'At least one response is required')
    .max(86, 'Cannot have more than 86 responses')
    .refine((responses) => {
      // Check for duplicate item IDs
      const itemIds = responses.map(r => r.itemId);
      const uniqueIds = new Set(itemIds);
      return uniqueIds.size === itemIds.length;
    }, 'Duplicate item IDs are not allowed'),
  
  rawScores: rawScoresSchema,
  
  sectionComments: z.array(sectionCommentSchema)
    .max(9, 'Cannot have more than 9 section comments')
    .optional()
}).strict();

// Simplified schema for creating assessments (auto-calculate scores)
export const createAssessmentSchema = z.object({
  child: childSchema,
  examiner: examinerSchema.optional(),
  caregiver: caregiverSchema.optional(),
  responses: z.array(responseSchema)
    .min(1, 'At least one response is required')
    .max(86, 'Cannot have more than 86 responses')
    .refine((responses) => {
      const itemIds = responses.map(r => r.itemId);
      const uniqueIds = new Set(itemIds);
      return uniqueIds.size === itemIds.length;
    }, 'Duplicate item IDs are not allowed'),
  
  sectionComments: z.array(sectionCommentSchema)
    .max(9, 'Cannot have more than 9 section comments')
    .optional()
}).strict();

// Update assessment schema (partial updates allowed)
export const updateAssessmentSchema = assessmentSchema.partial().strict();

// Query parameter validation
export const assessmentQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .refine(n => n > 0, 'Page must be greater than 0')
    .optional(),
  
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .optional(),
  
  childId: z.string()
    .uuid('Child ID must be a valid UUID')
    .optional(),
  
  examinerId: z.string()
    .uuid('Examiner ID must be a valid UUID')
    .optional(),
  
  dateFrom: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date from must be in YYYY-MM-DD format')
    .optional(),
  
  dateTo: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date to must be in YYYY-MM-DD format')
    .optional()
}).strict().refine((data) => {
  if (data.dateFrom && data.dateTo) {
    return new Date(data.dateFrom) <= new Date(data.dateTo);
  }
  return true;
}, 'Date from must be before or equal to date to');

// Type exports
export type AssessmentPayload = z.infer<typeof assessmentSchema>;
export type CreateAssessmentPayload = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentPayload = z.infer<typeof updateAssessmentSchema>;
export type AssessmentQuery = z.infer<typeof assessmentQuerySchema>;

// Transform function with enhanced validation
export const transformPayloadForService = (payload: CreateAssessmentPayload) => {
  try {
    // Import scoring functions dynamically to avoid circular imports
    const { calculateScores, validateScores } = require('../../../infrastructure/utils/scoring/scoringService');
    
    // Calculate scores from responses
    const scoringResults = calculateScores(payload.responses);
    
    // Check for invalid responses
    if (scoringResults.invalidResponses.length > 0) {
      throw new ValidationError(
        'Invalid responses detected',
        { invalidResponses: scoringResults.invalidResponses }
      );
    }
    
    // Validate calculated scores
    const scoreWarnings = validateScores(scoringResults);
    if (scoreWarnings.length > 0) {
      throw new ValidationError(
        'Calculated scores are outside expected ranges',
        { warnings: scoreWarnings }
      );
    }
    
    return {
      child: payload.child,
      examiner: payload.examiner,
      caregiver: payload.caregiver,
      responses: payload.responses,
      rawScores: scoringResults.sectionScores,
      sectionComments: payload.sectionComments || []
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Failed to process assessment data',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
};

// Validation helper functions
export const validateChildAge = (birthDate: string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  if (age < 3 || age > 14) {
    throw new ValidationError(`Child age ${age} is outside the valid range (3-14 years)`);
  }
  
  return age;
};

export const validateRequiredResponses = (responses: Array<{ itemId: number, response: string }>): void => {
  const itemCounts = {
    auditoryProcessing: 0,
    visualProcessing: 0,
    tactileProcessing: 0,
    movementProcessing: 0,
    bodyPositionProcessing: 0,
    oralSensitivityProcessing: 0,
    behavioralResponses: 0,
    socialEmotionalResponses: 0,
    attentionResponses: 0
  };
  
  // Count items per section based on 86-item structure
  responses.forEach(response => {
    if (response.itemId >= 1 && response.itemId <= 8) itemCounts.auditoryProcessing++;
    else if (response.itemId >= 9 && response.itemId <= 14) itemCounts.visualProcessing++; // excluding 15
    else if (response.itemId >= 16 && response.itemId <= 26) itemCounts.tactileProcessing++;
    else if (response.itemId >= 27 && response.itemId <= 34) itemCounts.movementProcessing++;
    else if (response.itemId >= 35 && response.itemId <= 42) itemCounts.bodyPositionProcessing++;
    else if (response.itemId >= 43 && response.itemId <= 52) itemCounts.oralSensitivityProcessing++;
    else if (response.itemId >= 53 && response.itemId <= 61) itemCounts.behavioralResponses++;
    else if (response.itemId >= 62 && response.itemId <= 75) itemCounts.socialEmotionalResponses++;
    else if (response.itemId >= 76 && response.itemId <= 85) itemCounts.attentionResponses++; // excluding 86
  });
  
  // Check minimum requirements (at least 50% of items per section)
  const errors: string[] = [];
  if (itemCounts.auditoryProcessing < 4) errors.push('Auditory Processing section needs at least 4 responses');
  if (itemCounts.visualProcessing < 3) errors.push('Visual Processing section needs at least 3 responses');
  if (itemCounts.tactileProcessing < 6) errors.push('Tactile Processing section needs at least 6 responses');
  if (itemCounts.movementProcessing < 4) errors.push('Movement Processing section needs at least 4 responses');
  if (itemCounts.bodyPositionProcessing < 4) errors.push('Body Position Processing section needs at least 4 responses');
  if (itemCounts.oralSensitivityProcessing < 5) errors.push('Oral Sensitivity Processing section needs at least 5 responses');
  if (itemCounts.behavioralResponses < 5) errors.push('Behavioral Responses section needs at least 5 responses');
  if (itemCounts.socialEmotionalResponses < 7) errors.push('Social Emotional Responses section needs at least 7 responses');
  if (itemCounts.attentionResponses < 5) errors.push('Attention Responses section needs at least 5 responses');
  
  if (errors.length > 0) {
    throw new ValidationError('Insufficient responses for valid assessment', { errors });
  }
};
