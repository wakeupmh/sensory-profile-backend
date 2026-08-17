import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { PushSubscriptionService } from '../../../application/services/PushSubscriptionService';
import { createPushSubscriptionSchema, deletePushSubscriptionSchema } from '../validations/pushSubscriptionValidation';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class PushSubscriptionController {
  constructor(private readonly service: PushSubscriptionService) {}

  getPublicKey = asyncHandler(async (_req: Request, res: Response) => {
    jsonResponse(res, { publicKey: this.service.getPublicKey() });
  });

  subscribe = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { endpoint, keys } = createPushSubscriptionSchema.parse(req.body);
    logger.info(`[pushSubscription.subscribe] userId=${userId}`);
    await this.service.subscribe(userId, endpoint, keys.p256dh, keys.auth);
    jsonResponse(res, { subscribed: true }, 201, { message: 'Inscrito para notificações push' });
  });

  unsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { endpoint } = deletePushSubscriptionSchema.parse(req.body);
    logger.info(`[pushSubscription.unsubscribe] userId=${userId}`);
    await this.service.unsubscribe(userId, endpoint);
    res.status(204).send();
  });
}
