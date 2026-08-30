import { Router } from 'express';
import { transcriptionLimiter } from '../middleware/rateLimiters';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import { careTeamScopeMiddleware } from '../middleware/careTeamScopeMiddleware';
import pool from '../../../infrastructure/database/connection';

import { DailyReportController } from '../controllers/DailyReportController';
import { DailyReportService } from '../../../application/services/DailyReportService';
import { S3StorageService } from '../../../infrastructure/storage/S3StorageService';
import { TranscriptionService } from '../../../infrastructure/transcription/TranscriptionService';
import { AISummaryService } from '../../../application/services/AISummaryService';
import { ConsolidatedReportService } from '../../../application/services/ConsolidatedReportService';

const aiService = new AISummaryService(new ConsolidatedReportService(pool));
const dailyReportService = new DailyReportService(
  pool,
  new S3StorageService(),
  new TranscriptionService(),
  aiService,
);
const controller = new DailyReportController(dailyReportService);

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);
router.use(careTeamScopeMiddleware);

router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.post('/:id/transcribe', transcriptionLimiter, controller.start.bind(controller));
router.get('/:id/audio', controller.getAudioUrl.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
