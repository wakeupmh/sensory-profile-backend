import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { CommunicationLogService } from '../../../application/services/CommunicationLogService';
import {
  createCommunicationLogSchema,
  updateCommunicationLogSchema,
  listCommunicationLogFiltersSchema,
} from '../validations/developmentValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class CommunicationLogController {
  constructor(private readonly service: CommunicationLogService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createCommunicationLogSchema.parse(req.body);
    logger.info(`[communicationLog.create] userId=${userId}`);
    const result = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );
    jsonResponse(res, result.toJSON(), 201, { message: 'Registro de comunicação criado com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listCommunicationLogFiltersSchema.parse(req.query);
    logger.info(`[communicationLog.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[communicationLog.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateCommunicationLogSchema.parse(req.body);
    logger.info(`[communicationLog.update] userId=${userId} id=${req.params.id}`);
    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };
    const result = await this.service.update(req.params.id, payload, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Registro de comunicação atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[communicationLog.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
