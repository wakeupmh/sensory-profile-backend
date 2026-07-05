import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { SharedAccessController } from '../controllers/SharedAccessController';
import {
  anamneseRepository,
  anamneseShareService,
} from './anamneseRoutes';
import {
  assessmentRepository,
  responseRepository,
  assessmentShareService,
} from './assessmentRoutes';
import { professionalService } from './professionalRoutes';
import { accessLogService } from './childRoutes';

const controller = new SharedAccessController(
  professionalService,
  anamneseShareService,
  assessmentShareService,
  anamneseRepository,
  assessmentRepository,
  responseRepository,
  accessLogService,
);

const router = Router();
router.use(authMiddleware);

router.get('/anamneses', controller.listSharedAnamneses.bind(controller));
router.get('/anamneses/:id', controller.getSharedAnamnese.bind(controller));
router.get('/assessments', controller.listSharedAssessments.bind(controller));
router.get('/assessments/:id', controller.getSharedAssessment.bind(controller));

export default router;
