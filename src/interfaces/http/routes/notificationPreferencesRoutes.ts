import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { NotificationPreferencesController } from '../controllers/NotificationPreferencesController';
import { NotificationPreferencesService } from '../../../application/services/NotificationPreferencesService';
import { PgUserProfileRepository } from '../../../infrastructure/repositories/PgUserProfileRepository';

const userProfileRepository = new PgUserProfileRepository();
const service = new NotificationPreferencesService(userProfileRepository);
const controller = new NotificationPreferencesController(service);

export { userProfileRepository };

const router = Router();
router.use(authMiddleware);

router.get('/', controller.get.bind(controller));
router.patch('/', controller.update.bind(controller));

export default router;
