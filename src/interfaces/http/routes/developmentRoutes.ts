import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import milestoneRoutes from './developmentalMilestoneRoutes';
import communicationLogRoutes from './communicationLogRoutes';

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);
router.use('/milestones', milestoneRoutes);
router.use('/logs', communicationLogRoutes);

export default router;
