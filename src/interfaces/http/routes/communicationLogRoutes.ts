import { Router } from 'express';
import { PgCommunicationLogRepository } from '../../../infrastructure/repositories/PgCommunicationLogRepository';
import { CommunicationLogService } from '../../../application/services/CommunicationLogService';
import { CommunicationLogController } from '../controllers/CommunicationLogController';

// Module-level DI — authMiddleware applied by parent developmentRoutes.ts
const repo = new PgCommunicationLogRepository();
const service = new CommunicationLogService(repo);
const controller = new CommunicationLogController(service);

const router = Router();

router.post('/', controller.create.bind(controller));
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
