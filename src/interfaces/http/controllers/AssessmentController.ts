import { Request, Response } from 'express';
import { AssessmentService } from '../../../application/services/AssessmentService';
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
import { AssessmentNotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class AssessmentController {
  constructor(private assessmentService: AssessmentService) {}

  getAllAssessments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info(`[getAllAssessments] Fetching all assessments`);
    
    const userId = requireUserId(req);
    
    // Validate query parameters
    const queryParams = assessmentQuerySchema.parse(req.query);

    logger.debug(`[getAllAssessments] User ${userId} authorized, fetching assessments`, { queryParams });

    const result = await this.assessmentService.getAllAssessments(userId, {
      page: queryParams.page,
      limit: queryParams.limit,
      childId: queryParams.childId,
      dateFrom: queryParams.dateFrom,
      dateTo: queryParams.dateTo
    });

    logger.info(`[getAllAssessments] Successfully retrieved ${result.data.length} of ${result.total} assessments for user ${userId}`);

    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getAssessmentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[getAssessmentById] Getting assessment by id: ${id}`);
    
    assertValidId(id, 'assessment ID');
    
    const userId = requireUserId(req);
    
    logger.debug(`[getAssessmentById] User ${userId} authorized, fetching assessment ${id}`);
    
    const { assessment, responses } = await this.assessmentService.getAssessmentWithResponses(id, userId);
    
    if (!assessment) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[getAssessmentById] Successfully retrieved assessment ${id} with ${responses.length} responses for user ${userId}`);
    
    jsonResponse(res, {
      assessment,
      responses,
      responseCount: responses.length
    });
  });

  createAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info(`[createAssessment] Creating new assessment`);
    
    const userId = requireUserId(req);
    
    logger.debug(`[createAssessment] User ${userId} authorized, validating assessment data`);
    
    // Validate the request body against the schema
    const validatedData = createAssessmentSchema.parse(req.body);
    logger.debug(`[createAssessment] Assessment data validated successfully`);
    
    // Additional validation checks (some are gated by instrumentId)
    validateChildAge(validatedData.child.birthDate, validatedData.instrumentId);
    validateRequiredResponses(validatedData.responses, validatedData.instrumentId);

    // Transform and validate scoring
    const transformedData = transformPayloadForService(validatedData);
    logger.debug(`[createAssessment] Assessment data transformed, creating assessment`);

    const assessment = await this.assessmentService.createAssessment({
      instrumentId: transformedData.instrumentId,
      child: transformedData.child,
      examiner: transformedData.examiner,
      caregiver: transformedData.caregiver,
      responses: transformedData.responses,
      rawScores: transformedData.rawScores,
      sectionComments: transformedData.sectionComments as SectionComment[],
      parentAssessmentId: transformedData.parentAssessmentId
    }, userId);
    
    logger.info(`[createAssessment] Assessment created successfully with id: ${assessment.getId()}`);
    
    jsonResponse(res, assessment, 201, { message: 'Assessment created successfully' });
  });

  updateAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[updateAssessment] Updating assessment with id: ${id}`);
    
    assertValidId(id, 'assessment ID');
    
    const userId = requireUserId(req);
    
    logger.debug(`[updateAssessment] User ${userId} authorized, validating assessment data for update`);
    
    // Validate the request body against the schema
    const validatedData = updateAssessmentSchema.parse(req.body);
    logger.debug(`[updateAssessment] Assessment update data validated successfully`);
    
    const updatedAssessment = await this.assessmentService.updateAssessment(id, validatedData, userId);
    
    if (!updatedAssessment) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[updateAssessment] Assessment ${id} updated successfully`);
    
    jsonResponse(res, updatedAssessment, 200, { message: 'Assessment updated successfully' });
  });

  deleteAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[deleteAssessment] Deleting assessment with id: ${id}`);
    
    assertValidId(id, 'assessment ID');
    
    const userId = requireUserId(req);
    
    logger.debug(`[deleteAssessment] User ${userId} authorized, attempting to delete assessment ${id}`);
    
    const success = await this.assessmentService.deleteAssessment(id, userId);
    
    if (!success) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[deleteAssessment] Assessment ${id} deleted successfully by user ${userId}`);
    
    jsonMessage(res, 'Assessment deleted successfully');
  });

  generateReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    logger.info(`[generateReport] Generating report for assessment with id: ${id}`);
    
    assertValidId(id, 'assessment ID');
    
    const userId = requireUserId(req);
    
    logger.debug(`[generateReport] User ${userId} authorized, generating report for assessment ${id}`);
    
    const report = await this.assessmentService.generateReport(id, userId);
    
    if (!report) {
      throw new AssessmentNotFoundError(id);
    }
    
    logger.info(`[generateReport] Report for assessment ${id} generated successfully for user ${userId}`);
    
    jsonResponse(res, report, 200, { message: 'Report generated successfully' });
  });
}
