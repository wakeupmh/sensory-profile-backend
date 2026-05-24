import { Router } from 'express';
import { ComorbidityController } from '../controllers/ComorbidityController';
import { ComorbidityService } from '../../../application/services/ComorbidityService';
import { PgComorbidityRepository } from '../../../infrastructure/repositories/PgComorbidityRepository';

const comorbidityRepository = new PgComorbidityRepository();
const comorbidityService = new ComorbidityService(comorbidityRepository);
const comorbidityController = new ComorbidityController(comorbidityService);

const router = Router();
// authMiddleware applied by parent medicalRoutes.ts

router.get('/', comorbidityController.list.bind(comorbidityController));
router.get('/:id', comorbidityController.getById.bind(comorbidityController));
router.post('/', comorbidityController.create.bind(comorbidityController));
router.patch('/:id', comorbidityController.update.bind(comorbidityController));
router.delete('/:id', comorbidityController.remove.bind(comorbidityController));

export default router;
