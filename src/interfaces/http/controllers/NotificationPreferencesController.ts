import { Request, Response } from 'express';
import { NotificationPreferencesService } from '../../../application/services/NotificationPreferencesService';
import { updateNotificationPreferencesSchema } from '../validations/notificationPreferencesValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  get = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const profile = await this.service.get(userId);
    jsonResponse(res, profile.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { reminderEmailsEnabled } = updateNotificationPreferencesSchema.parse(req.body);
    const profile = await this.service.setReminderEmailsEnabled(userId, reminderEmailsEnabled);
    jsonResponse(res, profile.toJSON(), 200, { message: 'Preferências atualizadas' });
  });
}
