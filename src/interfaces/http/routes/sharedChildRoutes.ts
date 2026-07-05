import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../../../infrastructure/database/connection';

import { SharedChildController } from '../controllers/SharedChildController';
import { SharedChildDataService } from '../../../application/services/SharedChildDataService';
import { professionalService } from './professionalRoutes';
import { childShareRepository, professionalNoteService, accessLogService } from './childRoutes';

import { ProfessionalNoteController } from '../controllers/ProfessionalNoteController';

const dataService = new SharedChildDataService(pool);
const controller = new SharedChildController(professionalService, childShareRepository, dataService, accessLogService);

const professionalNoteController = new ProfessionalNoteController(
  professionalNoteService,
  professionalService,
  accessLogService,
);

const router = Router();
router.use(authMiddleware);

router.get('/', controller.listSharedChildren.bind(controller));
router.get('/:childId/assessments', controller.getAssessments.bind(controller));
router.get('/:childId/daily-logs', controller.getDailyLogs.bind(controller));
router.get('/:childId/therapy', controller.getTherapy.bind(controller));
router.get('/:childId/medical', controller.getMedical.bind(controller));
router.get('/:childId/development', controller.getDevelopment.bind(controller));

// Limited write: professional-authored notes, never mutating the owner's own records.
router.post('/:childId/notes', professionalNoteController.create.bind(professionalNoteController));
router.get('/:childId/notes', professionalNoteController.listMine.bind(professionalNoteController));

export default router;
