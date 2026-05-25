import { Request, Response } from 'express';
import { DailyLogService } from '../../../application/services/DailyLogService';
import {
  createLogSchema,
  updateLogSchema,
  listFiltersSchema,
} from '../validations/dailyLogValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class DailyLogController {
  constructor(private readonly service: DailyLogService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId, logType, from, to, page, limit } = listFiltersSchema.parse(req.query);
    logger.info(`[dailyLog.list] userId=${userId}`);

    const result = await this.service.list(userId, {
      childId,
      logType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      limit,
    });

    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'log ID');
    const userId = requireUserId(req);
    logger.info(`[dailyLog.getById] id=${id} userId=${userId}`);

    const log = await this.service.getById(id, userId);

    jsonResponse(res, log);
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const parsed = createLogSchema.parse(req.body);
    logger.info(`[dailyLog.create] userId=${userId}`);

    const log = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );

    jsonResponse(res, log, 201, { message: 'Daily log created successfully' });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'log ID');
    const userId = requireUserId(req);
    const parsed = updateLogSchema.parse(req.body);
    logger.info(`[dailyLog.update] id=${id} userId=${userId}`);

    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };

    const log = await this.service.update(id, payload, userId);

    jsonResponse(res, log, 200, { message: 'Daily log updated successfully' });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'log ID');
    const userId = requireUserId(req);
    logger.info(`[dailyLog.remove] id=${id} userId=${userId}`);

    await this.service.remove(id, userId);

    res.status(204).send();
  });
}
