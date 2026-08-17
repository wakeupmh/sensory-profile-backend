import { Request, Response } from 'express';
import { DataExportService } from '../../../application/services/DataExportService';
import { AccountErasureService } from '../../../application/services/AccountErasureService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, AuthorizationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { assertDelegatedChildMatches, assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

/**
 * Account-wide export/erasure must use the caller's own identity, never
 * requireUserId()'s delegation resolution — a caregiver delegated to one
 * child must never be able to export or erase the child OWNER's entire
 * account just because effectiveUserId resolves to the owner. These routes
 * aren't mounted behind delegationMiddleware (see accountRoutes.ts), but
 * this is asserted directly too, so the invariant holds even if that ever
 * changes.
 */
function requireOwnUserId(req: Request): string {
  if (req.effectiveUserId) {
    throw new AuthorizationError('Account-level operations are not available through delegated access');
  }
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class AccountController {
  constructor(
    private readonly exportService: DataExportService,
    private readonly erasureService: AccountErasureService,
  ) {}

  exportChild = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId } = req.params;
    assertValidId(childId, 'childId');
    assertDelegatedChildMatches(req, childId);
    logger.info(`[account.exportChild] userId=${userId} childId=${childId}`);
    const result = await this.exportService.exportChild(userId, childId);
    jsonResponse(res, result);
  });

  exportAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireOwnUserId(req);
    logger.info(`[account.exportAccount] userId=${userId}`);
    const result = await this.exportService.exportAccount(userId);
    jsonResponse(res, result);
  });

  eraseAccount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireOwnUserId(req);
    logger.info(`[account.eraseAccount] userId=${userId} starting`);
    const result = await this.erasureService.eraseAccount(userId);
    logger.info(`[account.eraseAccount] userId=${userId} finished`, result);
    jsonResponse(res, result);
  });
}
