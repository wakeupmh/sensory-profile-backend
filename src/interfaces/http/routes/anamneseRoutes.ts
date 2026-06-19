import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { AnamneseController } from '../controllers/AnamneseController';
import { AnamneseService } from '../../../application/services/AnamneseService';
import { PgAnamneseRepository } from '../../../infrastructure/repositories/PgAnamneseRepository';
import { ResourceShareService } from '../../../application/services/ResourceShareService';
import { PgAnamneseShareRepository } from '../../../infrastructure/repositories/PgResourceShareRepository';
import { ResourceShareController } from '../controllers/ResourceShareController';
import { AnamneseNotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { professionalRepository } from './professionalRoutes';

const anamneseRepository = new PgAnamneseRepository();
const anamneseService = new AnamneseService(anamneseRepository);
const anamneseController = new AnamneseController(anamneseService);

const anamneseShareRepository = new PgAnamneseShareRepository();
const anamneseShareService = new ResourceShareService(
  anamneseShareRepository,
  professionalRepository,
  {
    resourceLabel: 'anamnese',
    async assertOwned(resourceId, ownerUserId) {
      const owned = await anamneseRepository.findById(resourceId, ownerUserId);
      if (!owned) throw new AnamneseNotFoundError(resourceId);
    },
  }
);
const anamneseShareController = new ResourceShareController(
  anamneseShareService,
  'anamnese',
  'id'
);

export { anamneseRepository, anamneseShareService };

const router = Router();

// Public: read-only access by share token. Must be registered BEFORE requireAuth().
router.get(
  '/shared/:shareToken',
  anamneseController.getByShareToken.bind(anamneseController)
);

router.use(authMiddleware);

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

// Per-professional share grants (named "shares" to distinguish from the
// public-token share above).
router.get('/:id/shares', anamneseShareController.list.bind(anamneseShareController));
router.post('/:id/shares', anamneseShareController.grant.bind(anamneseShareController));
router.delete(
  '/:id/shares/:professionalId',
  anamneseShareController.revoke.bind(anamneseShareController)
);

export default router;
