import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

import { ProfessionalController } from '../controllers/ProfessionalController';
import { ProfessionalService } from '../../../application/services/ProfessionalService';
import { PgProfessionalRepository } from '../../../infrastructure/repositories/PgProfessionalRepository';

const repo = new PgProfessionalRepository();
const service = new ProfessionalService(repo);
const controller = new ProfessionalController(service);

const router = Router();
router.use(authMiddleware);

// Owner-side directory
router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));
router.post('/:id/rotate-token', controller.rotateInvitation.bind(controller));

// Identity for the authenticated user: which professional records they hold
// (i.e. which invitations they accepted). The frontend uses this to decide
// whether to show the "shared with me" UI.
router.get('/me/identities', controller.listMyIdentities.bind(controller));

export default router;

// Invitation acceptance lives on a separate sub-router so we can mount it on
// a distinct path while still depending on the same service instance.
const acceptRouter = Router();
acceptRouter.use(authMiddleware);
acceptRouter.post('/accept', controller.acceptInvitation.bind(controller));
export { acceptRouter };

// Expose the controller's underlying service so other routers (share
// endpoints, shared-access endpoints) can reuse the same instance.
export { service as professionalService, repo as professionalRepository };
