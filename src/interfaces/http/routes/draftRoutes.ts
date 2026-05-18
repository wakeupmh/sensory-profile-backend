import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { FormDraftController } from '../controllers/FormDraftController';
import { FormDraftService } from '../../../application/services/FormDraftService';
import { PgFormDraftRepository } from '../../../infrastructure/repositories/PgFormDraftRepository';

const repo = new PgFormDraftRepository();
const service = new FormDraftService(repo);
const controller = new FormDraftController(service);

const router = Router();
router.use(authMiddleware);

router.get('/:form_type', controller.get.bind(controller));
router.put('/:form_type', controller.upsert.bind(controller));
router.delete('/:form_type', controller.delete.bind(controller));

export default router;
