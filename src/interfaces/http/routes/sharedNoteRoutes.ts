import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { ProfessionalNoteController } from '../controllers/ProfessionalNoteController';
import { professionalService } from './professionalRoutes';
import { professionalNoteService, accessLogService } from './childRoutes';

const controller = new ProfessionalNoteController(professionalNoteService, professionalService, accessLogService);

const router = Router();
router.use(authMiddleware);

// Author-only — enforced by matching professionalId, not just note id.
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export default router;
