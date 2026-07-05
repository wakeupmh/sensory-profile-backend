import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { CaregiverShareController } from '../controllers/CaregiverShareController';
import { caregiverShareService } from './childRoutes';

const controller = new CaregiverShareController(caregiverShareService);

const router = Router();
router.use(authMiddleware);
router.post('/accept', controller.acceptInvitation.bind(controller));

export default router;
