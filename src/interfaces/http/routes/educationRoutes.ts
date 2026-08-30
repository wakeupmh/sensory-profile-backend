import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import { careTeamScopeMiddleware } from '../middleware/careTeamScopeMiddleware';
import educationPlanRoutes from './educationPlanRoutes';
import schoolCommunicationRoutes from './schoolCommunicationRoutes';

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);
router.use(careTeamScopeMiddleware);
router.use('/plans', educationPlanRoutes);
router.use('/comms', schoolCommunicationRoutes);

export default router;
