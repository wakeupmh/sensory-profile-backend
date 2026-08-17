import { Request, Response } from 'express';
import { RetentionCleanupService } from '../../../application/services/RetentionCleanupService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { jsonResponse } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

/**
 * Same shape as ReminderDigestController: triggered by an external
 * scheduler, gated by the shared CRON_SECRET instead of a user session.
 */
export class RetentionCleanupController {
  constructor(private readonly service: RetentionCleanupService) {}

  run = asyncHandler(async (_req: Request, res: Response) => {
    logger.info('[retentionCleanup.run] starting');
    const result = await this.service.run();
    logger.info('[retentionCleanup.run] finished', result);
    jsonResponse(res, result);
  });
}
