import { domainRouter } from './domainRouter';
import educationPlanRoutes from './educationPlanRoutes';
import schoolCommunicationRoutes from './schoolCommunicationRoutes';

const router = domainRouter();
router.use('/plans', educationPlanRoutes);
router.use('/comms', schoolCommunicationRoutes);

export default router;
