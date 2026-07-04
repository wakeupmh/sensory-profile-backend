import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { ReminderService } from '../../../application/services/ReminderService';
import { UpcomingReminderService } from '../../../application/services/UpcomingReminderService';
import {
  createReminderSchema,
  updateReminderSchema,
  listReminderFiltersSchema,
  upcomingRemindersQuerySchema,
} from '../validations/reminderValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class ReminderController {
  constructor(
    private readonly service: ReminderService,
    private readonly upcomingService: UpcomingReminderService,
  ) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createReminderSchema.parse(req.body);
    logger.info(`[reminder.create] userId=${userId}`);
    const result = await this.service.create(
      { ...parsed, dueAt: new Date(parsed.dueAt) },
      userId,
    );
    jsonResponse(res, result.toJSON(), 201, { message: 'Lembrete criado com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listReminderFiltersSchema.parse(req.query);
    logger.info(`[reminder.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    jsonResponse(res, results.map((r: { toJSON: () => unknown }) => r.toJSON()));
  });

  getUpcoming = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { childId, days } = upcomingRemindersQuerySchema.parse(req.query);
    logger.info(`[reminder.upcoming] userId=${userId} days=${days}`);
    const results = await this.upcomingService.getUpcoming(userId, childId, days);
    jsonResponse(res, results, 200, { count: results.length });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[reminder.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateReminderSchema.parse(req.body);
    logger.info(`[reminder.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(
      req.params.id,
      { ...parsed, dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined },
      userId,
    );
    jsonResponse(res, result.toJSON(), 200, { message: 'Lembrete atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[reminder.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
