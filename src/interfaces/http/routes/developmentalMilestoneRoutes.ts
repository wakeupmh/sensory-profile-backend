import { Router } from 'express';
import { PgDevelopmentalMilestoneRepository } from '../../../infrastructure/repositories/PgDevelopmentalMilestoneRepository';
import { DevelopmentalMilestoneService } from '../../../application/services/DevelopmentalMilestoneService';
import { DevelopmentalMilestoneController } from '../controllers/DevelopmentalMilestoneController';

// Module-level DI — authMiddleware applied by parent developmentRoutes.ts
const repo = new PgDevelopmentalMilestoneRepository();
const service = new DevelopmentalMilestoneService(repo);
const controller = new DevelopmentalMilestoneController(service);

const router = Router();

router.post('/', controller.create.bind(controller));
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
