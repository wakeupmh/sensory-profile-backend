import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { AISummaryService } from '../../../application/services/AISummaryService';
import { AiSummaryHistoryService } from '../../../application/services/AiSummaryHistoryService';
import {
  generateAISummarySchema,
  listAiSummariesQuerySchema,
  askAiQuestionSchema,
} from '../validations/consolidatedReportValidation';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class AiInsightsController {
  constructor(
    private readonly historyService: AiSummaryHistoryService,
    private readonly aiService: AISummaryService,
  ) {}

  generateAndSave = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = generateAISummarySchema.parse(req.body);
    logger.info(`[aiInsights.generateAndSave] userId=${userId} childId=${parsed.childId}`);
    const summary = await this.historyService.generateAndSave(userId, parsed.childId, parsed.periodDays);
    jsonResponse(res, summary.toJSON(), 201, { message: 'Resumo gerado e salvo com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { childId } = listAiSummariesQuerySchema.parse(req.query);
    logger.info(`[aiInsights.list] userId=${userId} childId=${childId}`);
    const summaries = await this.historyService.list(childId, userId);
    jsonResponse(res, summaries.map((s) => s.toJSON()), 200, { count: summaries.length });
  });

  askQuestion = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = askAiQuestionSchema.parse(req.body);
    logger.info(`[aiInsights.askQuestion] userId=${userId} childId=${parsed.childId}`);
    const answer = await this.aiService.answerQuestion(userId, parsed.childId, parsed.question, parsed.periodDays);
    jsonResponse(res, { question: parsed.question, answer });
  });
}
