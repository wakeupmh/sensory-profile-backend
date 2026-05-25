import { Router } from 'express';
import { MedicalAppointmentController } from '../controllers/MedicalAppointmentController';
import { MedicalAppointmentService } from '../../../application/services/MedicalAppointmentService';
import { PgMedicalAppointmentRepository } from '../../../infrastructure/repositories/PgMedicalAppointmentRepository';

const medicalAppointmentRepository = new PgMedicalAppointmentRepository();
const medicalAppointmentService = new MedicalAppointmentService(medicalAppointmentRepository);
const medicalAppointmentController = new MedicalAppointmentController(medicalAppointmentService);

const router = Router();
// authMiddleware applied by parent medicalRoutes.ts

router.get('/', medicalAppointmentController.list.bind(medicalAppointmentController));
router.get('/:id', medicalAppointmentController.getById.bind(medicalAppointmentController));
router.post('/', medicalAppointmentController.create.bind(medicalAppointmentController));
router.patch('/:id', medicalAppointmentController.update.bind(medicalAppointmentController));
router.delete('/:id', medicalAppointmentController.remove.bind(medicalAppointmentController));

export default router;
