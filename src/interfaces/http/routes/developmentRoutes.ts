import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import milestoneRoutes from './developmentalMilestoneRoutes';
import communicationLogRoutes from './communicationLogRoutes';

const router = Router();

router.use(authMiddleware);
router.use('/milestones', milestoneRoutes);
router.use('/logs', communicationLogRoutes);

export default router;
