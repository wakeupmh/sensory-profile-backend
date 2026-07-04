import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { ChildController } from '../controllers/ChildController';
import { ChildService } from '../../../application/services/ChildService';
import { ChildProfileService } from '../../../application/services/ChildProfileService';
import { PgChildRepository } from '../../../infrastructure/repositories/PgChildRepository';
import pool from '../../../infrastructure/database/connection';

import { ChildShareController } from '../controllers/ChildShareController';
import { ChildShareService } from '../../../application/services/ChildShareService';
import { PgChildShareRepository } from '../../../infrastructure/repositories/PgChildShareRepository';
import { professionalRepository } from './professionalRoutes';

const repo = new PgChildRepository();
const service = new ChildService(repo);
const profileService = new ChildProfileService(pool);
const controller = new ChildController(service, profileService);

const childShareRepository = new PgChildShareRepository();
const childShareService = new ChildShareService(childShareRepository, professionalRepository, pool);
const childShareController = new ChildShareController(childShareService);

export { childShareRepository, childShareService };

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:childId/profile', controller.getProfile.bind(controller));
router.get('/:childId/timeline', controller.getTimeline.bind(controller));
router.get('/:childId/shares', childShareController.list.bind(childShareController));
router.post('/:childId/shares', childShareController.grant.bind(childShareController));
router.delete('/:childId/shares/:professionalId', childShareController.revoke.bind(childShareController));
router.get('/:id', controller.get.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
