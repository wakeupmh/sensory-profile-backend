import { domainRouter } from './domainRouter';
import milestoneRoutes from './developmentalMilestoneRoutes';
import communicationLogRoutes from './communicationLogRoutes';

const router = domainRouter();
router.use('/milestones', milestoneRoutes);
router.use('/logs', communicationLogRoutes);

export default router;
