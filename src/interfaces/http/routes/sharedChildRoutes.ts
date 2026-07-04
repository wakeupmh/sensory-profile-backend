import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../../../infrastructure/database/connection';

import { SharedChildController } from '../controllers/SharedChildController';
import { SharedChildDataService } from '../../../application/services/SharedChildDataService';
import { professionalService } from './professionalRoutes';
import { childShareRepository } from './childRoutes';

const dataService = new SharedChildDataService(pool);
const controller = new SharedChildController(professionalService, childShareRepository, dataService);

const router = Router();
router.use(authMiddleware);

router.get('/', controller.listSharedChildren.bind(controller));
router.get('/:childId/assessments', controller.getAssessments.bind(controller));
router.get('/:childId/daily-logs', controller.getDailyLogs.bind(controller));
router.get('/:childId/therapy', controller.getTherapy.bind(controller));
router.get('/:childId/medical', controller.getMedical.bind(controller));
router.get('/:childId/development', controller.getDevelopment.bind(controller));

export default router;
