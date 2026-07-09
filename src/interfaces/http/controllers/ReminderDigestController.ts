import { Request, Response } from 'express';
import { ReminderDigestService } from '../../../application/services/ReminderDigestService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { jsonResponse } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';
import { verifyCronSecret } from './controllerUtils';

/**
 * Triggered by an external scheduler (Render Cron Job, GitHub Actions
 * schedule, etc.) rather than a logged-in user — there is no per-user JWT
 * to check here, so this is gated by a shared secret instead of
 * authMiddleware. Deliberately mounted outside the /api/reminders router
 * (which requires a normal user session) to keep "user-facing" and
 * "system-facing" endpoints unambiguous.
 */
export class ReminderDigestController {
  constructor(private readonly service: ReminderDigestService) {}

  run = asyncHandler(async (req: Request, res: Response) => {
    verifyCronSecret(req, 'X-Cron-Secret');

    logger.info('[reminderDigest.run] starting');
    const result = await this.service.run();
    logger.info('[reminderDigest.run] finished', result);
    jsonResponse(res, result);
  });
}
