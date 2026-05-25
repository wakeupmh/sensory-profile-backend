import { Router } from 'express';
import { MedicationController } from '../controllers/MedicationController';
import { MedicationService } from '../../../application/services/MedicationService';
import { PgMedicationRepository } from '../../../infrastructure/repositories/PgMedicationRepository';

const medicationRepository = new PgMedicationRepository();
const medicationService = new MedicationService(medicationRepository);
const medicationController = new MedicationController(medicationService);

const router = Router();
// authMiddleware applied by parent medicalRoutes.ts

router.get('/', medicationController.list.bind(medicationController));
router.get('/:id', medicationController.getById.bind(medicationController));
router.post('/', medicationController.create.bind(medicationController));
router.patch('/:id', medicationController.update.bind(medicationController));
router.delete('/:id', medicationController.remove.bind(medicationController));

export default router;
