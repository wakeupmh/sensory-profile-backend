import { Request, Response } from 'express';

import { ResourceShareService } from '../../../application/services/ResourceShareService';
import { shareGrantBodySchema } from '../validations/professionalValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import logger from '../../../infrastructure/utils/logger';


export class ResourceShareController {
  constructor(
    private readonly service: ResourceShareService,
    private readonly resourceLabel: string,
    private readonly resourceParam: 'id'
  ) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const resourceId = req.params[this.resourceParam];
    assertValidId(resourceId, `${this.resourceLabel} ID`);
    const userId = requireUserId(req);
    const grants = await this.service.listForResource(resourceId, userId);
    res.status(200).json({
      success: true,
      data: grants,
      count: grants.length,
      timestamp: new Date().toISOString(),
    });
  });

  grant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const resourceId = req.params[this.resourceParam];
    assertValidId(resourceId, `${this.resourceLabel} ID`);
    const userId = requireUserId(req);
    const { professionalId } = shareGrantBodySchema.parse(req.body);
    logger.info(
      `[share.grant] ${this.resourceLabel}=${resourceId} professional=${professionalId} owner=${userId}`
    );
    const grant = await this.service.grant(resourceId, professionalId, userId);
    res.status(201).json({
      success: true,
      data: grant,
      message: `${this.resourceLabel} shared`,
      timestamp: new Date().toISOString(),
    });
  });

  revoke = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const resourceId = req.params[this.resourceParam];
    const { professionalId } = req.params;
    assertValidId(resourceId, `${this.resourceLabel} ID`);
    assertValidId(professionalId, 'professional ID');
    const userId = requireUserId(req);
    logger.info(
      `[share.revoke] ${this.resourceLabel}=${resourceId} professional=${professionalId} owner=${userId}`
    );
    await this.service.revoke(resourceId, professionalId, userId);
    res.status(200).json({
      success: true,
      message: 'Share revoked',
      timestamp: new Date().toISOString(),
    });
  });
}
