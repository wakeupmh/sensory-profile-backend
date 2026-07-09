import { Router } from 'express';
import pool from '../../../infrastructure/database/connection';
import { RetentionCleanupController } from '../controllers/RetentionCleanupController';
import { RetentionCleanupService } from '../../../application/services/RetentionCleanupService';

const service = new RetentionCleanupService(pool);
const controller = new RetentionCleanupController(service);

// No authMiddleware — triggered by an external scheduler, gated by
// CRON_SECRET inside the controller instead of a user session.
const router = Router();
router.post('/', controller.run.bind(controller));

export default router;
