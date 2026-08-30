import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import { careTeamScopeMiddleware } from '../middleware/careTeamScopeMiddleware';
import medicationRoutes from './medicationRoutes';
import comorbidityRoutes from './comorbidityRoutes';
import medicalAppointmentRoutes from './medicalAppointmentRoutes';

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);
router.use(careTeamScopeMiddleware);
router.use('/medications', medicationRoutes);
router.use('/comorbidities', comorbidityRoutes);
router.use('/appointments', medicalAppointmentRoutes);

export default router;
