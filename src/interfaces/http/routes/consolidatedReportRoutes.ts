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
import { domainRouter } from './domainRouter';

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

// Separate budget for free-text Q&A so a caregiver who regenerates quarterly
// summaries doesn't exhaust their ability to ask follow-up questions in the
// same window. Higher max since Q&A is expected to be more conversational.
const aiQuestionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).userId ?? req.ip ?? 'unknown',
  message: {
    success: false,
    error: {
      type: 'RateLimitError',
      message: 'Muitas perguntas. Tente novamente em uma hora.',
      statusCode: 429,
    },
  },
});

// Tudo daqui para baixo é autenticado e escopado; o encadeamento vem montado
// de `domainRouter`.
const secure = domainRouter();
secure.get('/summary', controller.getSummary.bind(controller));
secure.post('/shares', controller.createShare.bind(controller));
secure.get('/shares', controller.listShares.bind(controller));
secure.get('/shares/:id/token', controller.revealShareToken.bind(controller));
secure.delete('/shares/:id', controller.deleteShare.bind(controller));
secure.post('/ai-summary', aiSummaryLimiter, controller.generateAISummary.bind(controller));

// Persisted summary history (distinct from the ephemeral /ai-summary above)
secure.post('/ai-summaries', aiSummaryLimiter, aiInsightsController.generateAndSave.bind(aiInsightsController));
secure.get('/ai-summaries', aiInsightsController.list.bind(aiInsightsController));

// Free-text Q&A grounded in the same consolidated data
secure.post('/ai-question', aiQuestionLimiter, aiInsightsController.askQuestion.bind(aiInsightsController));

// Structured brief formatted for an upcoming medical appointment (not persisted)
secure.post(
  '/consultation-brief',
  aiSummaryLimiter,
  aiInsightsController.getConsultationBrief.bind(aiInsightsController),
);

/**
 * `/shared/:token` é PÚBLICA: quem abre o link não tem sessão nenhuma. Por isso
 * ela vive no router de fora, registrada ANTES do encadeamento — se entrasse no
 * `secure`, o `authMiddleware` a recusaria antes de ela casar. É a única rota do
 * app nessa condição, e é o motivo de este arquivo não ser um `domainRouter()`
 * puro como os outros.
 */
const router = Router();
router.get('/shared/:token', controller.getSharedSummary.bind(controller));
router.use(secure);

export default router;
