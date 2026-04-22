import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';

import { AnamneseService } from '../../../application/services/AnamneseService';
import {
  createAnamneseSchema,
  updateAnamneseSchema,
} from '../validations/anamneseValidation';
import {
  AuthenticationError,
  ValidationError,
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,128}$/;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new ValidationError('Invalid anamnese ID format');
  }
}

function assertValidShareToken(token: string | undefined): asserts token is string {
  if (!token || !SHARE_TOKEN_REGEX.test(token)) {
    throw new ValidationError('Invalid share token format');
  }
}

function requireUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new AuthenticationError();
  return userId;
}

export class AnamneseController {
  constructor(private readonly service: AnamneseService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[anamnese.list] userId=${userId}`);

    const data = await this.service.list(userId);

    res.status(200).json({
      success: true,
      data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[anamnese.getById] id=${id} userId=${userId}`);

    const anamnese = await this.service.getById(id, userId);

    res.status(200).json({
      success: true,
      data: anamnese.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const payload = createAnamneseSchema.parse(req.body);
    logger.info(`[anamnese.create] userId=${userId}`);

    const anamnese = await this.service.create(payload, userId);

    res.status(201).json({
      success: true,
      data: anamnese.toJSON(),
      message: 'Anamnese created successfully',
      timestamp: new Date().toISOString(),
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    const payload = updateAnamneseSchema.parse(req.body);
    logger.info(`[anamnese.update] id=${id} userId=${userId}`);

    const anamnese = await this.service.update(id, payload, userId);

    res.status(200).json({
      success: true,
      data: anamnese.toJSON(),
      message: 'Anamnese updated successfully',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[anamnese.remove] id=${id} userId=${userId}`);

    await this.service.remove(id, userId);

    res.status(200).json({
      success: true,
      message: 'Anamnese deleted successfully',
      timestamp: new Date().toISOString(),
    });
  });

  generateShareLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[anamnese.share.create] id=${id} userId=${userId}`);

    const result = await this.service.generateShareLink(id, userId);

    res.status(201).json({
      success: true,
      data: {
        shareToken: result.shareToken,
        sharedAt: result.sharedAt,
      },
      timestamp: new Date().toISOString(),
    });
  });

  revokeShareLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[anamnese.share.revoke] id=${id} userId=${userId}`);

    await this.service.revokeShareLink(id, userId);

    res.status(200).json({
      success: true,
      message: 'Share link revoked successfully',
      timestamp: new Date().toISOString(),
    });
  });

  getByShareToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { shareToken } = req.params;
    assertValidShareToken(shareToken);
    logger.info(`[anamnese.share.get] token=${shareToken.slice(0, 6)}…`);

    const anamnese = await this.service.getByShareToken(shareToken);

    res.status(200).json({
      success: true,
      data: anamnese.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });
}
