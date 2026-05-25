import { Router } from 'express';
import { TherapistController } from '../controllers/TherapistController';
import { TherapistService } from '../../../application/services/TherapistService';
import { PgTherapistRepository } from '../../../infrastructure/repositories/PgTherapistRepository';

const therapistRepository = new PgTherapistRepository();
const therapistService = new TherapistService(therapistRepository);
const therapistController = new TherapistController(therapistService);

const router = Router();
// authMiddleware applied by parent therapyRoutes.ts

router.get('/', therapistController.list.bind(therapistController));
router.get('/:id', therapistController.getById.bind(therapistController));
router.post('/', therapistController.create.bind(therapistController));
router.patch('/:id', therapistController.update.bind(therapistController));
router.delete('/:id', therapistController.remove.bind(therapistController));

export default router;
