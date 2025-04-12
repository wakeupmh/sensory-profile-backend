import { Request, Response } from 'express';
import { AssessmentService } from '../../../application/services/AssessmentService';
import { getAuth } from '@clerk/express';
import { assessmentSchema, transformPayloadForService } from '../validations/assessmentValidation';
import { ZodError } from 'zod';
import { SectionComment } from '../../../application/services/SectionCommentService';
import logger from '../../../infrastructure/utils/logger';

export class AssessmentController {
  constructor(private assessmentService: AssessmentService) {}

  async getAllAssessments(req: Request, res: Response): Promise<void> {
    logger.info(`[getAllAssessments] Fetching all assessments`);
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[getAllAssessments] Unauthorized access attempt`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[getAllAssessments] User ${userId} authorized, fetching assessments`);
      const assessments = await this.assessmentService.getAllAssessments(userId);
      logger.info(`[getAllAssessments] Successfully retrieved ${assessments.length} assessments for user ${userId}`);
      res.status(200).json(assessments);
    } catch (error: any) {
      logger.error(`[getAllAssessments] Error getting all assessments: ${error.message}`, { error });
      res.status(500).json({ 
        message: 'Erro ao buscar avaliações', 
        error: error.message 
      });
    }
  }

  async getAssessmentById(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    logger.info(`[getAssessmentById] Getting assessment by id: ${id}`);
    
    if (!id) {
      logger.warn(`[getAssessmentById] Invalid ID provided`);
      res.status(400).json({ message: 'ID inválido' });
      return;
    }
    
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[getAssessmentById] Unauthorized access attempt for assessment ${id}`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[getAssessmentById] User ${userId} authorized, fetching assessment ${id}`);
      const { assessment, responses } = await this.assessmentService.getAssessmentWithResponses(id, userId);
      
      if (!assessment) {
        logger.warn(`[getAssessmentById] Assessment with id ${id} not found for user ${userId}`);
        res.status(404).json({ message: 'Avaliação não encontrada' });
        return;
      }
      
      logger.info(`[getAssessmentById] Successfully retrieved assessment ${id} with ${responses.length} responses for user ${userId}`);
      res.status(200).json({ assessment, responses });
    } catch (error: any) {
      logger.error(`[getAssessmentById] Error getting assessment ${id}: ${error.message}`, { error });
      console.log(error);
      res.status(500).json({ 
        message: 'Erro ao buscar avaliação', 
        error: error.message 
      });
    }
  }

  async createAssessment(req: Request, res: Response): Promise<void> {
    logger.info(`[createAssessment] Creating new assessment`);
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[createAssessment] Unauthorized access attempt`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[createAssessment] User ${userId} authorized, validating assessment data`);
      // Validate the request body against the schema
      try {
        const validatedData = assessmentSchema.parse(req.body);
        logger.debug(`[createAssessment] Assessment data validated successfully`);
        
        const transformedData = transformPayloadForService(validatedData);
        logger.debug(`[createAssessment] Assessment data transformed, creating assessment`);
        
        const assessment = await this.assessmentService.createAssessment({
          child: transformedData.child,
          examiner: transformedData.examiner,
          caregiver: transformedData.caregiver,
          responses: transformedData.responses,
          rawScores: transformedData.rawScores,
          sectionComments: transformedData.sectionComments as SectionComment[]
        }, userId);
        
        logger.info(`[createAssessment] Assessment created successfully with id: ${assessment.getId()}`);
        res.status(201).json(assessment);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          logger.warn(`[createAssessment] Validation error in assessment data: ${JSON.stringify(validationError.errors)}`);
          res.status(400).json({
            message: 'Dados de avaliação inválidos',
            errors: validationError.errors
          });
        } else {
          throw validationError;
        }
      }
    } catch (error: any) {
      logger.error(`[createAssessment] Error creating assessment: ${error.message}`, { error });
      console.error('Error creating assessment:', error);
      res.status(500).json({ 
        message: 'Erro ao criar avaliação', 
        error: error.message 
      });
    }
  }

  async updateAssessment(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    logger.info(`[updateAssessment] Updating assessment with id: ${id}`);
    
    if (!id) {
      logger.warn(`[updateAssessment] Invalid ID provided for update`);
      res.status(400).json({ message: 'ID inválido' });
      return;
    }
    
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[updateAssessment] Unauthorized access attempt to updateAssessment for id: ${id}`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[updateAssessment] User ${userId} authorized, validating assessment data for update`);
      // Validate the request body against the schema
      try {
        const validatedData = assessmentSchema.parse(req.body);
        logger.debug(`[updateAssessment] Assessment update data validated successfully`);
        
        const transformedData = transformPayloadForService(validatedData);
        logger.debug(`[updateAssessment] Assessment update data transformed, updating assessment ${id}`);
        
        const updatedAssessment = await this.assessmentService.updateAssessment(id, {
          child: transformedData.child,
          examiner: transformedData.examiner,
          caregiver: transformedData.caregiver,
          responses: transformedData.responses,
          rawScores: transformedData.rawScores,
          sectionComments: transformedData.sectionComments as SectionComment[]
        }, userId);
        
        if (!updatedAssessment) {
          logger.warn(`[updateAssessment] Assessment with id ${id} not found for update by user ${userId}`);
          res.status(404).json({ message: 'Avaliação não encontrada' });
          return;
        }
        
        logger.info(`[updateAssessment] Assessment ${id} updated successfully`);
        res.status(200).json(updatedAssessment);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          logger.warn(`[updateAssessment] Validation error in assessment update data: ${JSON.stringify(validationError.errors)}`);
          res.status(400).json({
            message: 'Dados de avaliação inválidos',
            errors: validationError.errors
          });
        } else {
          throw validationError;
        }
      }
    } catch (error: any) {
      logger.error(`[updateAssessment] Error updating assessment ${id}: ${error.message}`, { error });
      res.status(500).json({ 
        message: 'Erro ao atualizar avaliação', 
        error: error.message 
      });
    }
  }

  async deleteAssessment(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    logger.info(`[deleteAssessment] Deleting assessment with id: ${id}`);
    
    if (!id) {
      logger.warn(`[deleteAssessment] Invalid ID provided for deletion`);
      res.status(400).json({ message: 'ID inválido' });
      return;
    }
    
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[deleteAssessment] Unauthorized access attempt to deleteAssessment for id: ${id}`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[deleteAssessment] User ${userId} authorized, attempting to delete assessment ${id}`);
      const success = await this.assessmentService.deleteAssessment(id, userId);
      
      if (!success) {
        logger.warn(`[deleteAssessment] Assessment with id ${id} not found for deletion by user ${userId}`);
        res.status(404).json({ message: 'Avaliação não encontrada' });
        return;
      }
      
      logger.info(`[deleteAssessment] Assessment ${id} deleted successfully by user ${userId}`);
      res.status(204).send();
    } catch (error: any) {
      logger.error(`[deleteAssessment] Error deleting assessment ${id}: ${error.message}`, { error });
      res.status(500).json({ 
        message: 'Erro ao excluir avaliação', 
        error: error.message 
      });
    }
  }

  async generateReport(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    logger.info(`[generateReport] Generating report for assessment with id: ${id}`);
    
    if (!id) {
      logger.warn(`[generateReport] Invalid ID provided for report generation`);
      res.status(400).json({ message: 'ID inválido' });
      return;
    }
    
    try {
      const { userId } = getAuth(req);
      
      if (!userId) {
        logger.warn(`[generateReport] Unauthorized access attempt to generateReport for id: ${id}`);
        res.status(401).json({ message: 'Não autorizado' });
        return;
      }
      
      logger.debug(`[generateReport] User ${userId} authorized, generating report for assessment ${id}`);
      const report = await this.assessmentService.generateReport(id, userId);
      
      if (!report) {
        logger.warn(`[generateReport] Assessment with id ${id} not found for report generation by user ${userId}`);
        res.status(404).json({ message: 'Avaliação não encontrada' });
        return;
      }
      
      logger.info(`[generateReport] Report for assessment ${id} generated successfully for user ${userId}`);
      res.status(200).json(report);
    } catch (error: any) {
      logger.error(`[generateReport] Error generating report for assessment ${id}: ${error.message}`, { error });
      res.status(500).json({ 
        message: 'Erro ao gerar relatório', 
        error: error.message 
      });
    }
  }
}
