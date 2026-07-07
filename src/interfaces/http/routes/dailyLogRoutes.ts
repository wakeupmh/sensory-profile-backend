import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import pool from '../../../infrastructure/database/connection';

import { DailyLogController } from '../controllers/DailyLogController';
import { DailyLogService } from '../../../application/services/DailyLogService';
import { PgDailyLogRepository } from '../../../infrastructure/repositories/PgDailyLogRepository';
import { BehaviorInsightsController } from '../controllers/BehaviorInsightsController';
import { BehaviorInsightsService } from '../../../application/services/BehaviorInsightsService';
import { LogAttachmentController } from '../controllers/LogAttachmentController';
import { LogAttachmentService } from '../../../application/services/LogAttachmentService';
import { PgLogAttachmentRepository } from '../../../infrastructure/repositories/PgLogAttachmentRepository';
import { S3StorageService } from '../../../infrastructure/storage/S3StorageService';

const dailyLogRepository = new PgDailyLogRepository();
const dailyLogService = new DailyLogService(dailyLogRepository);

const logAttachmentRepository = new PgLogAttachmentRepository();
const storageService = new S3StorageService();
const logAttachmentService = new LogAttachmentService(logAttachmentRepository, dailyLogService, storageService);
const logAttachmentController = new LogAttachmentController(logAttachmentService);

const dailyLogController = new DailyLogController(dailyLogService, logAttachmentService);

const behaviorInsightsService = new BehaviorInsightsService(pool);
const behaviorInsightsController = new BehaviorInsightsController(behaviorInsightsService);

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);

// Registered before '/:id' — two path segments, so no collision, but kept
// first for readability.
router.get('/insights/behavior', behaviorInsightsController.getInsights.bind(behaviorInsightsController));

router.get('/', dailyLogController.list.bind(dailyLogController));
router.get('/:id', dailyLogController.getById.bind(dailyLogController));
router.post('/', dailyLogController.create.bind(dailyLogController));
router.patch('/:id', dailyLogController.update.bind(dailyLogController));
router.delete('/:id', dailyLogController.remove.bind(dailyLogController));

router.post('/:id/attachments', logAttachmentController.requestUpload.bind(logAttachmentController));
router.get('/:id/attachments', logAttachmentController.list.bind(logAttachmentController));
router.delete('/:id/attachments/:attachmentId', logAttachmentController.remove.bind(logAttachmentController));

export default router;
