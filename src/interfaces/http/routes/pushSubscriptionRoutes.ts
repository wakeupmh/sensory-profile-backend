import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { PushSubscriptionController } from '../controllers/PushSubscriptionController';
import { PushSubscriptionService } from '../../../application/services/PushSubscriptionService';
import { PgPushSubscriptionRepository } from '../../../infrastructure/repositories/PgPushSubscriptionRepository';
import { WebPushService } from '../../../infrastructure/push/WebPushService';

const pushSubscriptionRepository = new PgPushSubscriptionRepository();
const webPushService = new WebPushService();
const service = new PushSubscriptionService(pushSubscriptionRepository, webPushService);
const controller = new PushSubscriptionController(service);

export { pushSubscriptionRepository, webPushService };

const router = Router();
router.use(authMiddleware);

router.get('/public-key', controller.getPublicKey.bind(controller));
router.post('/', controller.subscribe.bind(controller));
router.delete('/', controller.unsubscribe.bind(controller));

export default router;
