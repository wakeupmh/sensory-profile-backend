import { Router } from 'express';
import pool from '../../../infrastructure/database/connection';
import { RetentionCleanupController } from '../controllers/RetentionCleanupController';
import { RetentionCleanupService } from '../../../application/services/RetentionCleanupService';
import { cronAuthMiddleware } from '../middleware/cronAuthMiddleware';

const service = new RetentionCleanupService(pool);
const controller = new RetentionCleanupController(service);

const router = Router();
// Autenticado por segredo compartilhado (CRON_SECRET), não por sessão de
// usuário: quem chama é um agendador externo, não uma pessoa logada.
router.use(cronAuthMiddleware);
router.post('/', controller.run.bind(controller));

export default router;
