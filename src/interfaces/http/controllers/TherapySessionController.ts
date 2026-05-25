import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { TherapySessionService } from '../../../application/services/TherapySessionService';
import { createSessionSchema, updateSessionSchema, listSessionFiltersSchema } from '../validations/therapySessionValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class TherapySessionController {
  constructor(private readonly service: TherapySessionService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listSessionFiltersSchema.parse(req.query);
    logger.info(`[therapySession.list] userId=${userId}`);
    const result = await this.service.list(userId, {
      ...parsed,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });
    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapySession.getById] userId=${userId} id=${req.params.id}`);
    const session = await this.service.getById(req.params.id, userId);
    jsonResponse(res, session);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createSessionSchema.parse(req.body);
    logger.info(`[therapySession.create] userId=${userId}`);
    const session = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );
    jsonResponse(res, session, 201, { message: 'Sessão criada com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateSessionSchema.parse(req.body);
    logger.info(`[therapySession.update] userId=${userId} id=${req.params.id}`);
    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };
    const session = await this.service.update(req.params.id, payload, userId);
    jsonResponse(res, session, 200, { message: 'Sessão atualizada com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapySession.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
