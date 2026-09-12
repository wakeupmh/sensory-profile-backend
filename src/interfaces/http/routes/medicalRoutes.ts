import { domainRouter } from './domainRouter';
import medicationRoutes from './medicationRoutes';
import comorbidityRoutes from './comorbidityRoutes';
import medicalAppointmentRoutes from './medicalAppointmentRoutes';

const router = domainRouter();
router.use('/medications', medicationRoutes);
router.use('/comorbidities', comorbidityRoutes);
router.use('/appointments', medicalAppointmentRoutes);

export default router;
