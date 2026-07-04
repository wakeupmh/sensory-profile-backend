import { Request, Response } from 'express';
import { ChildShareService } from '../../../application/services/ChildShareService';
import { grantChildShareSchema } from '../validations/childShareValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class ChildShareController {
  constructor(private readonly service: ChildShareService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    logger.info(`[childShare.list] childId=${childId} owner=${userId}`);
    const grants = await this.service.listForChild(childId, userId);
    jsonResponse(res, grants.map((g) => g.toJSON()), 200, { count: grants.length });
  });

  grant = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const { professionalId, scopes } = grantChildShareSchema.parse(req.body);
    logger.info(`[childShare.grant] childId=${childId} professional=${professionalId} owner=${userId}`);
    const grant = await this.service.grant(childId, professionalId, scopes, userId);
    jsonResponse(res, grant.toJSON(), 201, { message: 'Criança compartilhada com sucesso' });
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    const { childId, professionalId } = req.params;
    assertValidId(childId, 'child ID');
    assertValidId(professionalId, 'professional ID');
    const userId = requireUserId(req);
    logger.info(`[childShare.revoke] childId=${childId} professional=${professionalId} owner=${userId}`);
    await this.service.revoke(childId, professionalId, userId);
    jsonMessage(res, 'Compartilhamento revogado');
  });
}
