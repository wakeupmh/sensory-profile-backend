import { Request, Response } from 'express';


import { AnamneseService } from '../../../application/services/AnamneseService';
import {
  createAnamneseSchema,
  updateAnamneseSchema,
} from '../validations/anamneseValidation';
import {
  ValidationError,
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,128}$/;

function assertValidShareToken(token: string | undefined): asserts token is string {
  if (!token || !SHARE_TOKEN_REGEX.test(token)) {
    throw new ValidationError('Invalid share token format');
  }
}

export class AnamneseController {
  constructor(private readonly service: AnamneseService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[anamnese.list] userId=${userId}`);

    const data = await this.service.list(userId);

    jsonResponse(res, data, 200, { count: data.length });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    logger.info(`[anamnese.getById] id=${id} userId=${userId}`);

    const anamnese = await this.service.getById(id, userId);

    jsonResponse(res, anamnese.toJSON());
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const payload = createAnamneseSchema.parse(req.body);
    logger.info(`[anamnese.create] userId=${userId}`);

    const anamnese = await this.service.create(payload, userId);

    jsonResponse(res, anamnese.toJSON(), 201, { message: 'Anamnese created successfully' });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    const payload = updateAnamneseSchema.parse(req.body);
    logger.info(`[anamnese.update] id=${id} userId=${userId}`);

    const anamnese = await this.service.update(id, payload, userId);

    jsonResponse(res, anamnese.toJSON(), 200, { message: 'Anamnese updated successfully' });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    logger.info(`[anamnese.remove] id=${id} userId=${userId}`);

    await this.service.remove(id, userId);

    jsonMessage(res, 'Anamnese deleted successfully');
  });

  generateShareLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    logger.info(`[anamnese.share.create] id=${id} userId=${userId}`);

    const result = await this.service.generateShareLink(id, userId);

    jsonResponse(res, {
      shareToken: result.shareToken,
      sharedAt: result.sharedAt,
    }, 201);
  });

  revokeShareLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    logger.info(`[anamnese.share.revoke] id=${id} userId=${userId}`);

    await this.service.revokeShareLink(id, userId);

    jsonMessage(res, 'Share link revoked successfully');
  });

  getByShareToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { shareToken } = req.params;
    assertValidShareToken(shareToken);
    logger.info(`[anamnese.share.get] token=${shareToken.slice(0, 6)}…`);

    const anamnese = await this.service.getByShareToken(shareToken);

    jsonResponse(res, anamnese.toJSON());
  });
}
