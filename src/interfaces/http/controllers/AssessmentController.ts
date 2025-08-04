import { Request, Response } from 'express';
import { AssessmentService } from '../../../application/services/AssessmentService';
import { getAuth } from '@clerk/express';
import { 
  createAssessmentSchema, 
  updateAssessmentSchema,
  assessmentQuerySchema,
  transformPayloadForService,
  validateChildAge,
  validateRequiredResponses
} from '../validations/assessmentValidation';
import { SectionComment } from '../../../application/services/SectionCommentService';
import logger from '../../../infrastructure/utils/logger';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  AssessmentNotFoundError
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';

export class AssessmentController {
  constructor(private assessmentService: AssessmentService) {}

  getAllAssessments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info(`[getAllAssessments] Fetching all assessments`);
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    // Validate query parameters
    const queryParams = assessmentQuerySchema.parse(req.query);
    
    logger.debug(`[getAllAssessments] User ${userId} authorized, fetching assessments`, { queryParams });
    
    const assessments = await this.assessmentService.getAllAssessments(userId);
    
    logger.info(`[getAllAssessments] Successfully retrieved ${assessments.length} assessments for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data: assessments,
      count: assessments.length,
      timestamp: new Date().toISOString()
    });
  });

  getAssessmentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[getAssessmentById] Getting assessment by id: ${id}`);
    
    if (!id || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new ValidationError('Invalid assessment ID format');
    }
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    logger.debug(`[getAssessmentById] User ${userId} authorized, fetching assessment ${id}`);
    
    const { assessment, responses } = await this.assessmentService.getAssessmentWithResponses(id, userId);
    
    if (!assessment) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[getAssessmentById] Successfully retrieved assessment ${id} with ${responses.length} responses for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data: {
        assessment,
        responses,
        responseCount: responses.length
      },
      timestamp: new Date().toISOString()
    });
  });

  createAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info(`[createAssessment] Creating new assessment`);
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    logger.debug(`[createAssessment] User ${userId} authorized, validating assessment data`);
    
    // Validate the request body against the schema
    const validatedData = createAssessmentSchema.parse(req.body);
    logger.debug(`[createAssessment] Assessment data validated successfully`);
    
    // Additional validation checks
    validateChildAge(validatedData.child.birthDate);
    validateRequiredResponses(validatedData.responses);
    
    // Transform and validate scoring
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
    
    res.status(201).json({
      success: true,
      data: assessment,
      message: 'Assessment created successfully',
      timestamp: new Date().toISOString()
    });
  });

  updateAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[updateAssessment] Updating assessment with id: ${id}`);
    
    if (!id || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new ValidationError('Invalid assessment ID format');
    }
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    logger.debug(`[updateAssessment] User ${userId} authorized, validating assessment data for update`);
    
    // Validate the request body against the schema
    const validatedData = updateAssessmentSchema.parse(req.body);
    logger.debug(`[updateAssessment] Assessment update data validated successfully`);
    
    const updatedAssessment = await this.assessmentService.updateAssessment(id, validatedData, userId);
    
    if (!updatedAssessment) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[updateAssessment] Assessment ${id} updated successfully`);
    
    res.status(200).json({
      success: true,
      data: updatedAssessment,
      message: 'Assessment updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  deleteAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[deleteAssessment] Deleting assessment with id: ${id}`);
    
    if (!id || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new ValidationError('Invalid assessment ID format');
    }
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    logger.debug(`[deleteAssessment] User ${userId} authorized, attempting to delete assessment ${id}`);
    
    const success = await this.assessmentService.deleteAssessment(id, userId);
    
    if (!success) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[deleteAssessment] Assessment ${id} deleted successfully by user ${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  generateReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[generateReport] Generating report for assessment with id: ${id}`);
    
    if (!id || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new ValidationError('Invalid assessment ID format');
    }
    
    const { userId } = getAuth(req);
    if (!userId) {
      throw new AuthenticationError();
    }
    
    logger.debug(`[generateReport] User ${userId} authorized, generating report for assessment ${id}`);
    
    const report = await this.assessmentService.generateReport(id, userId);
    
    if (!report) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[generateReport] Report for assessment ${id} generated successfully for user ${userId}`);
    
    res.status(200).json({
      success: true,
      data: report,
      message: 'Report generated successfully',
      timestamp: new Date().toISOString()
    });
  });
}
