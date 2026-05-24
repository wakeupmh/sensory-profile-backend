import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import therapistRouter from './therapistRoutes';
import therapySessionRouter from './therapySessionRoutes';

const router = Router();

router.use(authMiddleware);
router.use('/therapists', therapistRouter);
router.use('/sessions', therapySessionRouter);

export default router;
