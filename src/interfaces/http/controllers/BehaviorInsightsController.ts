import { Request, Response } from 'express';
import { BehaviorInsightsService } from '../../../application/services/BehaviorInsightsService';
import { behaviorInsightsQuerySchema } from '../validations/dailyLogValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class BehaviorInsightsController {
  constructor(private readonly service: BehaviorInsightsService) {}

  getInsights = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId, days } = behaviorInsightsQuerySchema.parse(req.query);
    logger.info(`[behaviorInsights.get] userId=${userId} childId=${childId} days=${days}`);

    const insights = await this.service.getInsights(childId, userId, days);

    jsonResponse(res, insights);
  });
}
