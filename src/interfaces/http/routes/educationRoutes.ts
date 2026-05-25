import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import educationPlanRoutes from './educationPlanRoutes';
import schoolCommunicationRoutes from './schoolCommunicationRoutes';

const router = Router();

router.use(authMiddleware);
router.use('/plans', educationPlanRoutes);
router.use('/comms', schoolCommunicationRoutes);

export default router;
