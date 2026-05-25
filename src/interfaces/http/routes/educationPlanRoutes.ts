import { Router } from 'express';
import { PgEducationPlanRepository } from '../../../infrastructure/repositories/PgEducationPlanRepository';
import { EducationPlanService } from '../../../application/services/EducationPlanService';
import { EducationPlanController } from '../controllers/EducationPlanController';

// Module-level DI — authMiddleware applied by parent educationRoutes.ts
const repo = new PgEducationPlanRepository();
const service = new EducationPlanService(repo);
const controller = new EducationPlanController(service);

const router = Router();

router.post('/', controller.create.bind(controller));
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
