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
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';
import { jsonResponse } from '../utils/response';

export class ReminderController extends CrudController {
  constructor(
    service: ReminderService,
    private readonly upcomingService: UpcomingReminderService,
  ) {
    super(
      crudController({
        service,
        label: 'reminder',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listReminderFiltersSchema },
        create: {
          schema: createReminderSchema,
          message: 'Lembrete criado com sucesso',
          toPayload: (parsed) => ({ ...parsed, dueAt: new Date(parsed.dueAt) }),
        },
        update: {
          schema: updateReminderSchema,
          message: 'Lembrete atualizado com sucesso',
          toPayload: (parsed) => ({
            ...parsed,
            dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined,
          }),
        },
      }),
    );
  }

  /** Fora do CRUD: outro service, outra janela de tempo, e devolve `{ count }`. */
  getUpcoming = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { childId, days } = upcomingRemindersQuerySchema.parse(req.query);
    logger.info(`[reminder.upcoming] userId=${userId} days=${days}`);
    const results = await this.upcomingService.getUpcoming(userId, childId, days);
    jsonResponse(res, results, 200, { count: results.length });
  });
}
