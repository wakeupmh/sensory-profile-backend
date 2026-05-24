import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../../../infrastructure/database/connection';
import { PgReportShareRepository } from '../../../infrastructure/repositories/PgReportShareRepository';
import { ConsolidatedReportService } from '../../../application/services/ConsolidatedReportService';
import { ReportShareService } from '../../../application/services/ReportShareService';
import { AISummaryService } from '../../../application/services/AISummaryService';
import { ConsolidatedReportController } from '../controllers/ConsolidatedReportController';
import { authMiddleware } from '../middleware/authMiddleware';

// Module-level DI
const reportShareRepo = new PgReportShareRepository();
const consolidatedService = new ConsolidatedReportService(pool);
const shareService = new ReportShareService(reportShareRepo, consolidatedService, pool);
const aiService = new AISummaryService(consolidatedService);
const controller = new ConsolidatedReportController(consolidatedService, shareService, aiService);

// Rate limiter for the AI summary endpoint: 10 requests per 60 minutes
const aiSummaryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.id ?? req.ip ?? 'unknown',
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

export default router;
