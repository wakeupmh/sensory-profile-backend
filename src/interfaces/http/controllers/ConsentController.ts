import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { ConsentService } from '../../../application/services/ConsentService';
import { requireOwnUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';
import { acceptConsentSchema } from '../validations/consentValidation';

/** Consent is the account holder's own act, so delegated access never reaches it. */
export class ConsentController {
  constructor(private readonly service: ConsentService) {}

  getConsent = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    jsonResponse(res, await this.service.getStatus(userId));
  });

  acceptConsent = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { version } = acceptConsentSchema.parse(req.body);
    const status = await this.service.accept(userId, version);
    logger.info(`[consent.accept] userId=${userId} version=${version}`);
    jsonResponse(res, status, 201);
  });
}
