import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { ConsolidatedReportService } from '../../../application/services/ConsolidatedReportService';
import { ReportShareService } from '../../../application/services/ReportShareService';
import { AISummaryService } from '../../../application/services/AISummaryService';
import {
  getSummaryQuerySchema,
  createShareSchema,
  listSharesQuerySchema,
  generateAISummarySchema,
} from '../validations/consolidatedReportValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class ConsolidatedReportController {
  constructor(
    private readonly consolidatedService: ConsolidatedReportService,
    private readonly shareService: ReportShareService,
    private readonly aiService: AISummaryService,
  ) {}

  getSummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = getSummaryQuerySchema.parse(req.query);
    logger.info(`[consolidatedReport.getSummary] userId=${userId} childId=${parsed.childId}`);
    const summary = await this.consolidatedService.getSummary(userId, parsed.childId, parsed.periodDays);
    jsonResponse(res, summary);
  });

  createShare = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createShareSchema.parse(req.body);
    logger.info(`[consolidatedReport.createShare] userId=${userId} childId=${parsed.childId}`);
    const share = await this.shareService.createShare(userId, parsed.childId, parsed.expiresInDays, parsed.periodDays);
    jsonResponse(res, {
      share: share.toJSON(),
      shareUrl: `${process.env.FRONTEND_URL}/consolidated/shared/${share.getToken()}`,
    }, 201);
  });

  listShares = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listSharesQuerySchema.parse(req.query);
    logger.info(`[consolidatedReport.listShares] userId=${userId} childId=${parsed.childId}`);
    const shares = await this.shareService.listShares(userId, parsed.childId);
    jsonResponse(res, { shares: shares.map((s) => s.toJSON()) });
  });

  deleteShare = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    logger.info(`[consolidatedReport.deleteShare] userId=${userId} id=${id}`);
    await this.shareService.deleteShare(id, userId);
    res.status(204).send();
  });

  getSharedSummary = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    logger.info(`[consolidatedReport.getSharedSummary] token=${token.slice(0, 4)}...${token.slice(-4)}`);
    const summary = await this.shareService.getSharedSummary(token);
    jsonResponse(res, summary);
  });

  generateAISummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = generateAISummarySchema.parse(req.body);
    logger.info(`[consolidatedReport.generateAISummary] userId=${userId} childId=${parsed.childId}`);
    const summaryText = await this.aiService.generateSummary(userId, parsed.childId, parsed.periodDays);
    jsonResponse(res, { summary: summaryText });
  });
}
