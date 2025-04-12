import { Assessment } from '../../domain/entities/Assessment';
import { Response } from '../../domain/entities/Response';
import { AssessmentRepository } from '../../domain/repositories/AssessmentRepository';
import { ResponseRepository } from '../../domain/repositories/ResponseRepository';
import { calculateScores } from '../../infrastructure/utils/scoring/scoringService';
import { v7 as uuidv7 } from 'uuid';
import { ChildService } from './ChildService';
import { ExaminerService } from './ExaminerService';
import { CaregiverService } from './CaregiverService';
import { SectionCommentService } from './SectionCommentService';
import logger from '../../infrastructure/utils/logger';

export class AssessmentService {
  constructor(
    private assessmentRepository: AssessmentRepository,
    private responseRepository: ResponseRepository,
    private childService: ChildService,
    private examinerService: ExaminerService,
    private caregiverService: CaregiverService,
    private sectionCommentService: SectionCommentService
  ) {}

  async getAllAssessments(userId: string): Promise<Assessment[]> {
    logger.info(`[AssessmentService] Getting all assessments for user ${userId}`);
    try {
      const assessments = await this.assessmentRepository.findAll(userId);
      logger.info(`[AssessmentService] Retrieved ${assessments.length} assessments for user ${userId}`);
      return assessments;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error retrieving assessments for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }

  async getAssessmentById(id: string, userId: string): Promise<Assessment | null> {
    logger.info(`[AssessmentService] Getting assessment with id ${id} for user ${userId}`);
    try {
      const assessment = await this.assessmentRepository.findById(id, userId);
      if (!assessment) {
        logger.warn(`[AssessmentService] Assessment with id ${id} not found for user ${userId}`);
      } else {
        logger.info(`[AssessmentService] Retrieved assessment with id ${id} for user ${userId}`);
      }
      return assessment;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error retrieving assessment with id ${id} for user ${userId}: ${error.message}`, { error });
      throw error;
    }
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
    child: {
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
    responses: Array<{ itemId: number, response: string }>;
    rawScores: {
      auditoryProcessing: number;
      visualProcessing: number;
      tactileProcessing: number;
      movementProcessing: number;
      bodyPositionProcessing: number;
      oralSensitivityProcessing: number;
      socialEmotionalResponses: number;
      attentionResponses: number;
    };
    sectionComments?: Array<{ section: string, comments: string }>;
  }, userId: string): Promise<Assessment> {
    logger.info(`[AssessmentService] Creating new assessment for user ${userId}`);
    try {
      logger.debug(`[AssessmentService] Finding or creating child for user ${userId}`);
      const childId = await this.childService.findOrCreateChild(assessmentData.child, userId);
      logger.debug(`[AssessmentService] Child id: ${childId} for user ${userId}`);
      
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
      
      const assessment = new Assessment(
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
        assessmentData.rawScores.socialEmotionalResponses,
        assessmentData.rawScores.attentionResponses,
        assessmentId
      );
      
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
    child?: {
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
        logger.debug(`[AssessmentService] Updating child data for assessment ${id}`);
        childId = await this.childService.findOrCreateChild(assessmentData.child, userId);
        logger.debug(`[AssessmentService] Updated child id: ${childId}`);
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
        existingAssessment.getSocialEmotionalResponsesRawScore(),
        existingAssessment.getAttentionResponsesRawScore(),
        existingAssessment.getId(),
        existingAssessment.getCreatedAt(),
        existingAssessment.getUpdatedAt()
      );
      
      // If raw scores are provided, update them
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
        if (assessmentData.rawScores.socialEmotionalResponses !== undefined) {
          updatedAssessment.setSocialEmotionalResponsesRawScore(assessmentData.rawScores.socialEmotionalResponses);
        }
        if (assessmentData.rawScores.attentionResponses !== undefined) {
          updatedAssessment.setAttentionResponsesRawScore(assessmentData.rawScores.attentionResponses);
        }
      }
      
      // If responses are provided, update them
      if (assessmentData.responses && assessmentData.responses.length > 0) {
        logger.debug(`[AssessmentService] Updating ${assessmentData.responses.length} responses for assessment ${id}`);
        // Delete existing responses
        await this.responseRepository.deleteByAssessmentId(id, userId);
        logger.debug(`[AssessmentService] Deleted existing responses for assessment ${id}`);
        
        // Create and save new responses
        const responseEntities = assessmentData.responses.map(
          r => new Response(id, r.itemId, r.response, uuidv7())
        );
        
        await this.responseRepository.saveMany(responseEntities, userId);
        logger.debug(`[AssessmentService] Saved new responses for assessment ${id}`);
      }
      
      // If section comments are provided, update them
      if (assessmentData.sectionComments && assessmentData.sectionComments.length > 0) {
        logger.debug(`[AssessmentService] Updating section comments for assessment ${id}`);
        // We would need to implement a method to delete existing comments first
        // For now, we'll just add new ones
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
      // Generate a report based on the assessment and responses
      // This is a placeholder for the actual report generation logic
      const report = {
        assessmentId: assessment.getId(),
        childId: assessment.getChildId(),
        date: assessment.getAssessmentDate(),
        scores: {
          auditoryProcessing: assessment.getAuditoryProcessingRawScore(),
          visualProcessing: assessment.getVisualProcessingRawScore(),
          tactileProcessing: assessment.getTactileProcessingRawScore(),
          movementProcessing: assessment.getMovementProcessingRawScore(),
          bodyPositionProcessing: assessment.getBodyPositionProcessingRawScore(),
          oralSensitivityProcessing: assessment.getOralSensitivityProcessingRawScore(),
          socialEmotionalResponses: assessment.getSocialEmotionalResponsesRawScore(),
          attentionResponses: assessment.getAttentionResponsesRawScore()
        },
        responseCount: responses.length
      };
      
      logger.info(`[AssessmentService] Report generated successfully for assessment ${id}`);
      return report;
    } catch (error: any) {
      logger.error(`[AssessmentService] Error generating report for assessment ${id} for user ${userId}: ${error.message}`, { error });
      throw error;
    }
  }
}
