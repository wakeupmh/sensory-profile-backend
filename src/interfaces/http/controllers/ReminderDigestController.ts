import { Request, Response } from 'express';
import { ReminderDigestService } from '../../../application/services/ReminderDigestService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { jsonResponse } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

/**
 * Triggered by an external scheduler (GitHub Actions) rather than a
 * logged-in user — there is no per-user JWT here, so the route is gated by
 * `cronAuthMiddleware` (shared CRON_SECRET) instead of `authMiddleware`.
 * Deliberately mounted outside the /api/reminders router (which requires a
 * normal user session) to keep "user-facing" and "system-facing" endpoints
 * unambiguous.
 */
export class ReminderDigestController {
  constructor(private readonly service: ReminderDigestService) {}

  run = asyncHandler(async (_req: Request, res: Response) => {
    logger.info('[reminderDigest.run] starting');
    const result = await this.service.run();
    logger.info('[reminderDigest.run] finished', result);
    jsonResponse(res, result);
  });
}
