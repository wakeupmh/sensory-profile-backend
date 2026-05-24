import { Assessment, DEFAULT_INSTRUMENT_ID } from '../../domain/entities/Assessment';
import { Response } from '../../domain/entities/Response';
import { AssessmentRepository, AssessmentQueryOptions, PaginatedResult } from '../../domain/repositories/AssessmentRepository';
import { ResponseRepository } from '../../domain/repositories/ResponseRepository';
import { calculateScores } from '../../infrastructure/utils/scoring/scoringService';
import { DataConsistencyValidator } from '../../infrastructure/utils/validation/DataConsistencyValidator';
import {
  NotFoundError,
  ValidationError,
  DataConsistencyError,
  AssessmentNotFoundError
} from '../../infrastructure/utils/errors/CustomErrors';
import { v7 as uuidv7 } from 'uuid';
import pool from '../../infrastructure/database/connection';
import { ChildService } from './ChildService';
import { ExaminerService } from './ExaminerService';
import { CaregiverService } from './CaregiverService';
import { SectionCommentService } from './SectionCommentService';
import logger from '../../infrastructure/utils/logger';
import { getInstrument } from '../../instruments/index';

// Zero values for the 9 SP-2 raw-score columns; used when persisting a new-
// instrument assessment so the INSERT still satisfies the schema.
const ZERO_RAW_SCORES = {
  auditoryProcessing: 0,
  visualProcessing: 0,
  tactileProcessing: 0,
  movementProcessing: 0,
  bodyPositionProcessing: 0,
  oralSensitivityProcessing: 0,
  behavioralResponses: 0,
  socialEmotionalResponses: 0,
  attentionResponses: 0,
} as const;

export class AssessmentService {
  constructor(
    private assessmentRepository: AssessmentRepository,
    private responseRepository: ResponseRepository,
    private childService: ChildService,
    private examinerService: ExaminerService,
    private caregiverService: CaregiverService,
    private sectionCommentService: SectionCommentService
  ) {}

  async getAllAssessments(userId: string, options?: AssessmentQueryOptions): Promise<PaginatedResult<Assessment>> {
    logger.info(`[AssessmentService] Getting all assessments for user ${userId}`);
    try {
      const result = await this.assessmentRepository.findAll(userId, options);
      logger.info(`[AssessmentService] Retrieved ${result.data.length} of ${result.total} assessments for user ${userId}`);
      return result;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error retrieving assessments for user ${userId}: ${error?.message ?? String(error)}`, { errorType: typeof error, errorKeys: error ? Object.keys(error) : [], errorJson: JSON.stringify(error), code: error?.code, stack: error?.stack });
      throw error;
    }
  }

  async getAssessmentById(id: string, userId: string): Promise<Assessment | null> {
    logger.info(`[AssessmentService] Getting assessment with id ${id} for user ${userId}`);
    
    const assessment = await this.assessmentRepository.findById(id, userId);
    if (!assessment) {
      logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}`);
      return null;
    }

    // Validate data consistency for retrieved assessment. The current
    // validator is hard-coded to the Criança 3-14 scoring map; skip it for
    // other instruments so we don't emit spurious mismatch warnings.
    if (assessment.getInstrumentId() === DEFAULT_INSTRUMENT_ID) {
      const responses = await this.responseRepository.findByAssessmentId(id, userId);
      const validationResult = DataConsistencyValidator.validateAssessmentScoreConsistency(assessment, responses);

      if (!validationResult.isValid) {
        logger.warn(`[AssessmentService] Data consistency issues found for assessment ${id}`, {
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }
    }

    logger.info(`[AssessmentService] Retrieved assessment with id ${id} for user ${userId}`);
    return assessment;
  }

  async getAssessmentWithResponses(id: string, userId: string): Promise<{ assessment: Assessment | null, responses: Response[] }> {
    logger.info(`[AssessmentService] Getting assessment with responses for id ${id} and user ${userId}`);
    try {
      const assessment = await this.assessmentRepository.findById(id, userId);
      
      if (!assessment) {
        logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}`);
        return { assessment: null, responses: [] };
      }
      
      logger.debug(`[AssessmentService] Assessment found, retrieving responses for assessment ${id}`);
      const responses = await this.responseRepository.findByAssessmentId(id, userId);
      logger.info(`[AssessmentService] Retrieved assessment with id ${id} and ${responses.length} responses for user ${userId}`);
      
      return { assessment, responses };
    } catch (error: any) {
      logger.error(`[AssessmentService] Error retrieving assessment with responses for id ${id} and user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }

  async createAssessment(assessmentData: {
    instrumentId?: string;
    child: {
      id?: string;
      name: string;
      birthDate: string;
      gender?: string;
      nationalIdentity?: string;
      otherInfo?: string;
    };
    examiner?: {
      name: string;
      profession: string;
      contact?: string;
    };
    caregiver?: {
      name: string;
      relationship: string;
      contact?: string;
    };
    parentAssessmentId?: string;
    responses: Array<{ itemId: number, response: string }>;
    rawScores: {
      auditoryProcessing: number;
      visualProcessing: number;
      tactileProcessing: number;
      movementProcessing: number;
      bodyPositionProcessing: number;
      oralSensitivityProcessing: number;
      behavioralResponses: number;
      socialEmotionalResponses: number;
      attentionResponses: number;
    };
    sectionComments?: Array<{ section: string, comments: string }>;
  }, userId: string): Promise<Assessment> {
    logger.info(`[AssessmentService] Creating new assessment for user ${userId}`);
    try {
      let childId: string;
      if (assessmentData.child.id) {
        logger.debug(`[AssessmentService] Validating child ownership id=${assessmentData.child.id} for user ${userId}`);
        const ownerCheck = await pool.query(
          `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
          [assessmentData.child.id, userId]
        );
        if (ownerCheck.rows.length === 0) {
          throw new NotFoundError('Child', assessmentData.child.id);
        }
        childId = assessmentData.child.id;
        logger.debug(`[AssessmentService] Child id validated: ${childId}`);
      } else {
        logger.debug(`[AssessmentService] Finding or creating child for user ${userId}`);
        childId = await this.childService.findOrCreateChild(assessmentData.child, userId);
        logger.debug(`[AssessmentService] Child id: ${childId} for user ${userId}`);
      }
      
      let examinerId = null;
      if (assessmentData.examiner) {
        logger.debug(`[AssessmentService] Creating examiner: ${assessmentData.examiner.name}`);
        examinerId = await this.examinerService.createExaminer(assessmentData.examiner);
        logger.debug(`[AssessmentService] Examiner id: ${examinerId}`);
      }
      
      let caregiverId = null;
      if (assessmentData.caregiver) {
        logger.debug(`[AssessmentService] Creating caregiver: ${assessmentData.caregiver.name}`);
        caregiverId = await this.caregiverService.createCaregiver(assessmentData.caregiver);
        logger.debug(`[AssessmentService] Caregiver id: ${caregiverId}`);
      }
      
      // Create assessment
      const assessmentId = uuidv7();
      logger.debug(`[AssessmentService] Generated assessment id: ${assessmentId}`);

      const instrumentId = assessmentData.instrumentId ?? DEFAULT_INSTRUMENT_ID;

      // Validate parent assessment linkage before persisting
      if (assessmentData.parentAssessmentId) {
        const parent = await this.assessmentRepository.findById(assessmentData.parentAssessmentId, userId);
        if (!parent) {
          throw new NotFoundError('Avaliação pai', assessmentData.parentAssessmentId);
        }
        if (parent.getInstrumentId() !== 'mchat-r') {
          throw new ValidationError('parentAssessmentId deve referenciar uma avaliação M-CHAT-R');
        }
        const parentScores = parent.getScoresJson() as { risk?: string } | null;
        if (!parentScores || parentScores.risk !== 'medio') {
          throw new ValidationError('Entrevista de acompanhamento só é aplicável para risco médio');
        }
        if (instrumentId !== 'mchat-rf-followup') {
          throw new ValidationError('Instrumento deve ser mchat-rf-followup quando parentAssessmentId é fornecido');
        }
      }

      const instrument = getInstrument(instrumentId);
      const isLegacy = !instrument || instrument.legacy === true;

      let assessment: Assessment;
      if (isLegacy) {
        // Legacy SP-2 path — use the pre-computed raw scores passed in from the validation layer.
        assessment = new Assessment(
          childId,
          examinerId,
          caregiverId,
          new Date(),
          assessmentData.rawScores.auditoryProcessing,
          assessmentData.rawScores.visualProcessing,
          assessmentData.rawScores.tactileProcessing,
          assessmentData.rawScores.movementProcessing,
          assessmentData.rawScores.bodyPositionProcessing,
          assessmentData.rawScores.oralSensitivityProcessing,
          assessmentData.rawScores.behavioralResponses,
          assessmentData.rawScores.socialEmotionalResponses,
          assessmentData.rawScores.attentionResponses,
          assessmentId,
          undefined,
          undefined,
          instrumentId
        );
      } else {
        // New instrument path — compute scores via the instrument's strategy.
        const responsesMap = new Map<number, string>(
          assessmentData.responses.map(r => [r.itemId, r.response])
        );
        const scoringResult = instrument.scoringStrategy(responsesMap, instrument);
        logger.debug(`[AssessmentService] New instrument scoring complete for ${instrumentId}`);

        assessment = new Assessment(
          childId,
          examinerId,
          caregiverId,
          new Date(),
          ZERO_RAW_SCORES.auditoryProcessing,
          ZERO_RAW_SCORES.visualProcessing,
          ZERO_RAW_SCORES.tactileProcessing,
          ZERO_RAW_SCORES.movementProcessing,
          ZERO_RAW_SCORES.bodyPositionProcessing,
          ZERO_RAW_SCORES.oralSensitivityProcessing,
          ZERO_RAW_SCORES.behavioralResponses,
          ZERO_RAW_SCORES.socialEmotionalResponses,
          ZERO_RAW_SCORES.attentionResponses,
          assessmentId,
          undefined,
          undefined,
          instrumentId
        );
        assessment.setScoresJson(scoringResult.scores_json);
      }
      
      if (assessmentData.parentAssessmentId) {
        assessment.setParentAssessmentId(assessmentData.parentAssessmentId);
      }

      logger.debug(`[AssessmentService] Saving assessment ${assessmentId} for user ${userId}`);
      const savedAssessment = await this.assessmentRepository.save(assessment, userId);
      logger.info(`[AssessmentService] Assessment ${savedAssessment.getId()} saved successfully for user ${userId}`);
      
      // Save responses
      logger.debug(`[AssessmentService] Creating ${assessmentData.responses.length} responses for assessment ${savedAssessment.getId()}`);
      const responseEntities = assessmentData.responses.map(
        r => new Response(savedAssessment.getId()!, r.itemId, r.response, uuidv7())
      );
      
      await this.responseRepository.saveMany(responseEntities, userId);
      logger.debug(`[AssessmentService] Responses saved for assessment ${savedAssessment.getId()}`);
      
      // Save section comments if provided
      if (assessmentData.sectionComments && assessmentData.sectionComments.length > 0) {
        logger.debug(`[AssessmentService] Saving ${assessmentData.sectionComments.length} section comments for assessment ${savedAssessment.getId()}`);
        await this.sectionCommentService.saveSectionComments(savedAssessment.getId()!, assessmentData.sectionComments);
        logger.debug(`[AssessmentService] Section comments saved for assessment ${savedAssessment.getId()}`);
      }
      
      logger.info(`[AssessmentService] Assessment creation completed successfully for id ${savedAssessment.getId()}`);
      return savedAssessment;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error creating assessment for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }

  async updateAssessment(id: string, assessmentData: {
    instrumentId?: string;
    child?: {
      id?: string;
      name: string;
      birthDate: string;
      gender?: string;
      nationalIdentity?: string;
      otherInfo?: string;
    };
    examiner?: {
      name: string;
      profession: string;
      contact?: string;
    };
    caregiver?: {
      name: string;
      relationship: string;
      contact?: string;
    };
    childId?: string;
    examinerId?: string | null;
    caregiverId?: string | null;
    assessmentDate?: Date;
    responses?: Array<{ itemId: number, response: string }>;
    rawScores?: {
      auditoryProcessing?: number;
      visualProcessing?: number;
      tactileProcessing?: number;
      movementProcessing?: number;
      bodyPositionProcessing?: number;
      oralSensitivityProcessing?: number;
      behavioralResponses?: number;
      socialEmotionalResponses?: number;
      attentionResponses?: number;
    };
    sectionComments?: Array<{ section: string, comments: string }>;
  }, userId: string): Promise<Assessment | null> {
    logger.info(`[AssessmentService] Updating assessment with id ${id} for user ${userId}`);
    try {
      const existingAssessment = await this.assessmentRepository.findById(id, userId);
      
      if (!existingAssessment) {
        logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}`);
        return null;
      }
      
      logger.debug(`[AssessmentService] Assessment found, processing update data`);
      
      // Update child data if provided
      let childId = existingAssessment.getChildId();
      if (assessmentData.child) {
        if (assessmentData.child.id) {
          logger.debug(`[AssessmentService] Validating child ownership id=${assessmentData.child.id} for user ${userId}`);
          const ownerCheck = await pool.query(
            `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
            [assessmentData.child.id, userId]
          );
          if (ownerCheck.rows.length === 0) {
            throw new NotFoundError('Child', assessmentData.child.id);
          }
          childId = assessmentData.child.id;
          logger.debug(`[AssessmentService] Updated child id (direct): ${childId}`);
        } else {
          logger.debug(`[AssessmentService] Updating child data for assessment ${id}`);
          childId = await this.childService.findOrCreateChild(assessmentData.child, userId);
          logger.debug(`[AssessmentService] Updated child id: ${childId}`);
        }
      }
      
      // Update examiner if provided
      let examinerId = existingAssessment.getExaminerId();
      if (assessmentData.examiner) {
        logger.debug(`[AssessmentService] Updating examiner data for assessment ${id}`);
        examinerId = await this.examinerService.createExaminer(assessmentData.examiner);
        logger.debug(`[AssessmentService] Updated examiner id: ${examinerId}`);
      }
      
      // Update caregiver if provided
      let caregiverId = existingAssessment.getCaregiverId();
      if (assessmentData.caregiver) {
        logger.debug(`[AssessmentService] Updating caregiver data for assessment ${id}`);
        caregiverId = await this.caregiverService.createCaregiver(assessmentData.caregiver);
        logger.debug(`[AssessmentService] Updated caregiver id: ${caregiverId}`);
      }
      
      // Update assessment fields if provided
      logger.debug(`[AssessmentService] Creating updated assessment object for id ${id}`);
      const updatedAssessment = new Assessment(
        childId,
        examinerId,
        caregiverId,
        assessmentData.assessmentDate || existingAssessment.getAssessmentDate(),
        existingAssessment.getAuditoryProcessingRawScore(),
        existingAssessment.getVisualProcessingRawScore(),
        existingAssessment.getTactileProcessingRawScore(),
        existingAssessment.getMovementProcessingRawScore(),
        existingAssessment.getBodyPositionProcessingRawScore(),
        existingAssessment.getOralSensitivityProcessingRawScore(),
        existingAssessment.getBehavioralResponsesRawScore(),
        existingAssessment.getSocialEmotionalResponsesRawScore(),
        existingAssessment.getAttentionResponsesRawScore(),
        existingAssessment.getId(),
        existingAssessment.getCreatedAt(),
        existingAssessment.getUpdatedAt(),
        assessmentData.instrumentId ?? existingAssessment.getInstrumentId()
      );
      
      const updatedInstrumentId = assessmentData.instrumentId ?? existingAssessment.getInstrumentId();
      const updatedInstrument = getInstrument(updatedInstrumentId);
      const updatedIsLegacy = !updatedInstrument || updatedInstrument.legacy === true;

      if (updatedIsLegacy) {
        // Legacy SP-2 path — apply any explicitly-provided raw score fields.
        if (assessmentData.rawScores) {
          logger.debug(`[AssessmentService] Updating raw scores for assessment ${id}`);
          if (assessmentData.rawScores.auditoryProcessing !== undefined) {
            updatedAssessment.setAuditoryProcessingRawScore(assessmentData.rawScores.auditoryProcessing);
          }
          if (assessmentData.rawScores.visualProcessing !== undefined) {
            updatedAssessment.setVisualProcessingRawScore(assessmentData.rawScores.visualProcessing);
          }
          if (assessmentData.rawScores.tactileProcessing !== undefined) {
            updatedAssessment.setTactileProcessingRawScore(assessmentData.rawScores.tactileProcessing);
          }
          if (assessmentData.rawScores.movementProcessing !== undefined) {
            updatedAssessment.setMovementProcessingRawScore(assessmentData.rawScores.movementProcessing);
          }
          if (assessmentData.rawScores.bodyPositionProcessing !== undefined) {
            updatedAssessment.setBodyPositionProcessingRawScore(assessmentData.rawScores.bodyPositionProcessing);
          }
          if (assessmentData.rawScores.oralSensitivityProcessing !== undefined) {
            updatedAssessment.setOralSensitivityProcessingRawScore(assessmentData.rawScores.oralSensitivityProcessing);
          }
          if (assessmentData.rawScores.behavioralResponses !== undefined) {
            updatedAssessment.setBehavioralResponsesRawScore(assessmentData.rawScores.behavioralResponses);
          }
          if (assessmentData.rawScores.socialEmotionalResponses !== undefined) {
            updatedAssessment.setSocialEmotionalResponsesRawScore(assessmentData.rawScores.socialEmotionalResponses);
          }
          if (assessmentData.rawScores.attentionResponses !== undefined) {
            updatedAssessment.setAttentionResponsesRawScore(assessmentData.rawScores.attentionResponses);
          }
        }
      } else {
        // New instrument path — re-compute scores from the incoming or existing responses.
        const responsesToScore = assessmentData.responses && assessmentData.responses.length > 0
          ? assessmentData.responses
          : await this.responseRepository.findByAssessmentId(id, userId).then(rs => rs.map(r => ({ itemId: r.getItemId(), response: r.getResponse() })));

        const responsesMap = new Map<number, string>(
          responsesToScore.map(r => [r.itemId, r.response])
        );
        const scoringResult = updatedInstrument.scoringStrategy(responsesMap, updatedInstrument);
        logger.debug(`[AssessmentService] New instrument re-scoring complete for ${updatedInstrumentId}`);
        updatedAssessment.setScoresJson(scoringResult.scores_json);
      }

      // If responses are provided, atomically replace them via the repository
      if (assessmentData.responses && assessmentData.responses.length > 0) {
        logger.debug(`[AssessmentService] Replacing ${assessmentData.responses.length} responses for assessment ${id}`);
        const responseEntities = assessmentData.responses.map(
          r => new Response(id, r.itemId, r.response, uuidv7())
        );
        await this.responseRepository.replaceByAssessmentId(id, responseEntities, userId);
        logger.debug(`[AssessmentService] Replaced responses for assessment ${id}`);
      }

      // If section comments are provided, delete existing and insert new
      if (assessmentData.sectionComments && assessmentData.sectionComments.length > 0) {
        logger.debug(`[AssessmentService] Updating section comments for assessment ${id}`);
        await this.sectionCommentService.deleteByAssessmentId(id);
        await this.sectionCommentService.saveSectionComments(id, assessmentData.sectionComments);
        logger.debug(`[AssessmentService] Updated section comments for assessment ${id}`);
      }
      
      logger.debug(`[AssessmentService] Saving updated assessment ${id}`);
      const result = await this.assessmentRepository.update(updatedAssessment, userId);
      logger.info(`[AssessmentService] Assessment ${id} updated successfully for user ${userId}`);
      
      return result;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error updating assessment ${id} for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }

  async deleteAssessment(id: string, userId: string): Promise<boolean> {
    logger.info(`[AssessmentService] Deleting assessment with id ${id} for user ${userId}`);
    try {
      const assessment = await this.assessmentRepository.findById(id, userId);
      
      if (!assessment) {
        logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}, cannot delete`);
        return false;
      }
      
      // Delete responses first (due to foreign key constraints)
      logger.debug(`[AssessmentService] Deleting responses for assessment ${id}`);
      await this.responseRepository.deleteByAssessmentId(id, userId);
      
      // Then delete the assessment
      logger.debug(`[AssessmentService] Deleting assessment ${id}`);
      await this.assessmentRepository.delete(id, userId);
      
      logger.info(`[AssessmentService] Assessment ${id} deleted successfully for user ${userId}`);
      return true;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error deleting assessment ${id} for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }

  async generateReport(id: string, userId: string): Promise<any> {
    logger.info(`[AssessmentService] Generating report for assessment with id ${id} for user ${userId}`);
    try {
      const { assessment, responses } = await this.getAssessmentWithResponses(id, userId);
      
      if (!assessment) {
        logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}, cannot generate report`);
        return null;
      }
      
      logger.debug(`[AssessmentService] Creating report for assessment ${id}`);

      const reportInstrumentId = assessment.getInstrumentId();
      const reportInstrument = getInstrument(reportInstrumentId);
      const reportIsLegacy = !reportInstrument || reportInstrument.legacy === true;

      let report: Record<string, unknown>;
      if (reportIsLegacy) {
        // Legacy SP-2 report shape — preserve existing field names for backward compatibility.
        report = {
          assessmentId: assessment.getId(),
          instrumentId: reportInstrumentId,
          childId: assessment.getChildId(),
          date: assessment.getAssessmentDate(),
          scores: {
            auditoryProcessing: assessment.getAuditoryProcessingRawScore(),
            visualProcessing: assessment.getVisualProcessingRawScore(),
            tactileProcessing: assessment.getTactileProcessingRawScore(),
            movementProcessing: assessment.getMovementProcessingRawScore(),
            bodyPositionProcessing: assessment.getBodyPositionProcessingRawScore(),
            oralSensitivityProcessing: assessment.getOralSensitivityProcessingRawScore(),
            behavioralResponses: assessment.getBehavioralResponsesRawScore(),
            socialEmotionalResponses: assessment.getSocialEmotionalResponsesRawScore(),
            attentionResponses: assessment.getAttentionResponsesRawScore()
          },
          responseCount: responses.length
        };
      } else {
        // New instrument report shape — scores come from scores_json.
        report = {
          assessmentId: assessment.getId(),
          instrumentId: reportInstrumentId,
          childId: assessment.getChildId(),
          date: assessment.getAssessmentDate(),
          scores: assessment.getScoresJson(),
          responses: responses.map(r => ({ itemId: r.getItemId(), response: r.getResponse() })),
          responseCount: responses.length
        };
      }
      
      logger.info(`[AssessmentService] Report generated successfully for assessment ${id}`);
      return report;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error generating report for assessment ${id} for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }
}
