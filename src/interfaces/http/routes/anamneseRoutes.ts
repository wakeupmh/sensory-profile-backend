import { Router } from 'express';
import { requireAuth } from '@clerk/express';

import { AnamneseController } from '../controllers/AnamneseController';
import { AnamneseService } from '../../../application/services/AnamneseService';
import { PgAnamneseRepository } from '../../../infrastructure/repositories/PgAnamneseRepository';

const anamneseRepository = new PgAnamneseRepository();
const anamneseService = new AnamneseService(anamneseRepository);
const anamneseController = new AnamneseController(anamneseService);

const router = Router();

// Public: read-only access by share token. Must be registered BEFORE requireAuth().
router.get(
  '/shared/:shareToken',
  anamneseController.getByShareToken.bind(anamneseController)
);

// Everything below requires an authenticated Clerk session.
router.use(requireAuth());

router.get('/', anamneseController.list.bind(anamneseController));
router.post('/', anamneseController.create.bind(anamneseController));
router.get('/:id', anamneseController.getById.bind(anamneseController));
router.put('/:id', anamneseController.update.bind(anamneseController));
router.delete('/:id', anamneseController.remove.bind(anamneseController));

router.post(
  '/:id/share',
  anamneseController.generateShareLink.bind(anamneseController)
);
router.delete(
  '/:id/share',
  anamneseController.revokeShareLink.bind(anamneseController)
);

export default router;
