import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../../../infrastructure/database/connection';
import { PgReportShareRepository } from '../../../infrastructure/repositories/PgReportShareRepository';
import { PgAiSummaryRepository } from '../../../infrastructure/repositories/PgAiSummaryRepository';
import { ConsolidatedReportService } from '../../../application/services/ConsolidatedReportService';
import { ReportShareService } from '../../../application/services/ReportShareService';
import { AISummaryService } from '../../../application/services/AISummaryService';
import { AiSummaryHistoryService } from '../../../application/services/AiSummaryHistoryService';
import { ConsolidatedReportController } from '../controllers/ConsolidatedReportController';
import { AiInsightsController } from '../controllers/AiInsightsController';
import { authMiddleware } from '../middleware/authMiddleware';

// Module-level DI
const reportShareRepo = new PgReportShareRepository();
const consolidatedService = new ConsolidatedReportService(pool);
const shareService = new ReportShareService(reportShareRepo, consolidatedService, pool);
const aiService = new AISummaryService(consolidatedService);
const controller = new ConsolidatedReportController(consolidatedService, shareService, aiService);

const aiSummaryRepo = new PgAiSummaryRepository();
const aiHistoryService = new AiSummaryHistoryService(aiSummaryRepo, aiService);
const aiInsightsController = new AiInsightsController(aiHistoryService, aiService);

// In-memory rate limiter — per-instance only. If scaled to multiple dynos, effective limit is max * dynos.
const aiSummaryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).userId ?? req.ip ?? 'unknown',
  message: {
    success: false,
    error: {
      type: 'RateLimitError',
      message: 'Muitas solicitações. Tente novamente em uma hora.',
      statusCode: 429,
    },
  },
});

const router = Router();

// PUBLIC route — must be before authMiddleware
router.get('/shared/:token', controller.getSharedSummary.bind(controller));

// Auth-protected routes
router.use(authMiddleware);
router.get('/summary', controller.getSummary.bind(controller));
router.post('/shares', controller.createShare.bind(controller));
router.get('/shares', controller.listShares.bind(controller));
router.delete('/shares/:id', controller.deleteShare.bind(controller));
router.post('/ai-summary', aiSummaryLimiter, controller.generateAISummary.bind(controller));

// Persisted summary history (distinct from the ephemeral /ai-summary above)
router.post('/ai-summaries', aiSummaryLimiter, aiInsightsController.generateAndSave.bind(aiInsightsController));
router.get('/ai-summaries', aiInsightsController.list.bind(aiInsightsController));

// Free-text Q&A grounded in the same consolidated data
router.post('/ai-question', aiSummaryLimiter, aiInsightsController.askQuestion.bind(aiInsightsController));

export default router;
