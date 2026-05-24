import { Request, Response } from 'express';

import { DailyLogService } from '../../../application/services/DailyLogService';
import {
  createLogSchema,
  updateLogSchema,
  listFiltersSchema,
} from '../validations/dailyLogValidation';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new ValidationError('Invalid log ID format');
  }
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

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

    res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[dailyLog.getById] id=${id} userId=${userId}`);

    const log = await this.service.getById(id, userId);

    res.status(200).json({
      success: true,
      data: log,
      timestamp: new Date().toISOString(),
    });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const parsed = createLogSchema.parse(req.body);
    logger.info(`[dailyLog.create] userId=${userId}`);

    const log = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );

    res.status(201).json({
      success: true,
      data: log,
      message: 'Daily log created successfully',
      timestamp: new Date().toISOString(),
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    const parsed = updateLogSchema.parse(req.body);
    logger.info(`[dailyLog.update] id=${id} userId=${userId}`);

    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };

    const log = await this.service.update(id, payload, userId);

    res.status(200).json({
      success: true,
      data: log,
      message: 'Daily log updated successfully',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id);
    const userId = requireUserId(req);
    logger.info(`[dailyLog.remove] id=${id} userId=${userId}`);

    await this.service.remove(id, userId);

    res.status(204).send();
  });
}
