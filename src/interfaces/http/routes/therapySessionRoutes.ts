import { Router } from 'express';
import { TherapySessionController } from '../controllers/TherapySessionController';
import { TherapySessionService } from '../../../application/services/TherapySessionService';
import { PgTherapySessionRepository } from '../../../infrastructure/repositories/PgTherapySessionRepository';
import { PgTherapistRepository } from '../../../infrastructure/repositories/PgTherapistRepository';

const therapySessionRepository = new PgTherapySessionRepository();
const therapistRepository = new PgTherapistRepository(); // needed by TherapySessionService for therapist validation
const therapySessionService = new TherapySessionService(therapySessionRepository, therapistRepository);
const therapySessionController = new TherapySessionController(therapySessionService);

const router = Router();
// authMiddleware applied by parent therapyRoutes.ts

router.get('/', therapySessionController.list.bind(therapySessionController));
router.get('/:id', therapySessionController.getById.bind(therapySessionController));
router.post('/', therapySessionController.create.bind(therapySessionController));
router.patch('/:id', therapySessionController.update.bind(therapySessionController));
router.delete('/:id', therapySessionController.remove.bind(therapySessionController));

export default router;
