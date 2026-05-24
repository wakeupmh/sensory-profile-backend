import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { DailyLogController } from '../controllers/DailyLogController';
import { DailyLogService } from '../../../application/services/DailyLogService';
import { PgDailyLogRepository } from '../../../infrastructure/repositories/PgDailyLogRepository';

const dailyLogRepository = new PgDailyLogRepository();
const dailyLogService = new DailyLogService(dailyLogRepository);
const dailyLogController = new DailyLogController(dailyLogService);

const router = Router();

router.use(authMiddleware);

router.get('/', dailyLogController.list.bind(dailyLogController));
router.get('/:id', dailyLogController.getById.bind(dailyLogController));
router.post('/', dailyLogController.create.bind(dailyLogController));
router.patch('/:id', dailyLogController.update.bind(dailyLogController));
router.delete('/:id', dailyLogController.remove.bind(dailyLogController));

export default router;
