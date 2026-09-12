import { domainRouter } from './domainRouter';
import therapistRouter from './therapistRoutes';
import therapySessionRouter from './therapySessionRoutes';

const router = domainRouter();
router.use('/therapists', therapistRouter);
router.use('/sessions', therapySessionRouter);

export default router;
