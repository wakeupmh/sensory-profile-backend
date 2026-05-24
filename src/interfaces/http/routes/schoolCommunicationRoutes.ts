import { Router } from 'express';
import { PgSchoolCommunicationRepository } from '../../../infrastructure/repositories/PgSchoolCommunicationRepository';
import { SchoolCommunicationService } from '../../../application/services/SchoolCommunicationService';
import { SchoolCommunicationController } from '../controllers/SchoolCommunicationController';

// Module-level DI — authMiddleware applied by parent educationRoutes.ts
const repo = new PgSchoolCommunicationRepository();
const service = new SchoolCommunicationService(repo);
const controller = new SchoolCommunicationController(service);

const router = Router();

router.post('/', controller.create.bind(controller));
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
