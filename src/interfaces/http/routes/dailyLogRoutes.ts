import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../../../infrastructure/database/connection';

import { DailyLogController } from '../controllers/DailyLogController';
import { DailyLogService } from '../../../application/services/DailyLogService';
import { PgDailyLogRepository } from '../../../infrastructure/repositories/PgDailyLogRepository';
import { BehaviorInsightsController } from '../controllers/BehaviorInsightsController';
import { BehaviorInsightsService } from '../../../application/services/BehaviorInsightsService';

const dailyLogRepository = new PgDailyLogRepository();
const dailyLogService = new DailyLogService(dailyLogRepository);
const dailyLogController = new DailyLogController(dailyLogService);

const behaviorInsightsService = new BehaviorInsightsService(pool);
const behaviorInsightsController = new BehaviorInsightsController(behaviorInsightsService);

const router = Router();

router.use(authMiddleware);

// Registered before '/:id' — two path segments, so no collision, but kept
// first for readability.
router.get('/insights/behavior', behaviorInsightsController.getInsights.bind(behaviorInsightsController));

router.get('/', dailyLogController.list.bind(dailyLogController));
router.get('/:id', dailyLogController.getById.bind(dailyLogController));
router.post('/', dailyLogController.create.bind(dailyLogController));
router.patch('/:id', dailyLogController.update.bind(dailyLogController));
router.delete('/:id', dailyLogController.remove.bind(dailyLogController));

export default router;
