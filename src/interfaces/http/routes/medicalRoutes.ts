import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import medicationRoutes from './medicationRoutes';
import comorbidityRoutes from './comorbidityRoutes';
import medicalAppointmentRoutes from './medicalAppointmentRoutes';

const router = Router();

router.use(authMiddleware);
router.use('/medications', medicationRoutes);
router.use('/comorbidities', comorbidityRoutes);
router.use('/appointments', medicalAppointmentRoutes);

export default router;
