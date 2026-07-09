import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { createDelegationMiddleware } from '../middleware/delegationMiddleware';
import { ChildController } from '../controllers/ChildController';
import { AccountController } from '../controllers/AccountController';
import { ChildService } from '../../../application/services/ChildService';
import { ChildProfileService } from '../../../application/services/ChildProfileService';
import { AccountErasureService } from '../../../application/services/AccountErasureService';
import { DataExportService } from '../../../application/services/DataExportService';
import { PgChildRepository } from '../../../infrastructure/repositories/PgChildRepository';
import { S3StorageService } from '../../../infrastructure/storage/S3StorageService';
import pool from '../../../infrastructure/database/connection';

import { ChildShareController } from '../controllers/ChildShareController';
import { ChildShareService } from '../../../application/services/ChildShareService';
import { PgChildShareRepository } from '../../../infrastructure/repositories/PgChildShareRepository';
import { professionalRepository, professionalService } from './professionalRoutes';

import { ProfessionalNoteController } from '../controllers/ProfessionalNoteController';
import { ProfessionalNoteService } from '../../../application/services/ProfessionalNoteService';
import { PgProfessionalNoteRepository } from '../../../infrastructure/repositories/PgProfessionalNoteRepository';
import { AccessLogController } from '../controllers/AccessLogController';
import { AccessLogService } from '../../../application/services/AccessLogService';
import { PgAccessLogRepository } from '../../../infrastructure/repositories/PgAccessLogRepository';

import { CaregiverShareController } from '../controllers/CaregiverShareController';
import { CaregiverShareService } from '../../../application/services/CaregiverShareService';
import { PgCaregiverShareRepository } from '../../../infrastructure/repositories/PgCaregiverShareRepository';

const repo = new PgChildRepository();
const service = new ChildService(repo);
const profileService = new ChildProfileService(pool);
const storageService = new S3StorageService();
const erasureService = new AccountErasureService(pool, storageService);
const controller = new ChildController(service, profileService, erasureService);

const exportService = new DataExportService(pool, storageService);
const accountController = new AccountController(exportService, erasureService);

const childShareRepository = new PgChildShareRepository();
const childShareService = new ChildShareService(childShareRepository, professionalRepository, pool);
const childShareController = new ChildShareController(childShareService);

const professionalNoteRepository = new PgProfessionalNoteRepository();
const professionalNoteService = new ProfessionalNoteService(professionalNoteRepository, childShareRepository, pool);

const accessLogRepository = new PgAccessLogRepository();
const accessLogService = new AccessLogService(accessLogRepository, pool);

const professionalNoteController = new ProfessionalNoteController(
  professionalNoteService,
  professionalService,
  accessLogService,
);
const accessLogController = new AccessLogController(accessLogService);

const caregiverShareRepository = new PgCaregiverShareRepository();
const caregiverShareService = new CaregiverShareService(caregiverShareRepository, pool);
const caregiverShareController = new CaregiverShareController(caregiverShareService);
const delegationMiddleware = createDelegationMiddleware(caregiverShareService, accessLogService);

export {
  childShareRepository,
  childShareService,
  professionalNoteService,
  accessLogService,
  caregiverShareService,
  delegationMiddleware,
  erasureService,
  storageService,
  exportService,
};

const router = Router();
router.use(authMiddleware);
router.use(delegationMiddleware);

router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:childId/profile', controller.getProfile.bind(controller));
router.get('/:childId/timeline', controller.getTimeline.bind(controller));
router.get('/:childId/export', accountController.exportChild.bind(accountController));
router.get('/:childId/shares', childShareController.list.bind(childShareController));
router.post('/:childId/shares', childShareController.grant.bind(childShareController));
router.delete('/:childId/shares/:professionalId', childShareController.revoke.bind(childShareController));
router.get('/:childId/notes', professionalNoteController.listForOwner.bind(professionalNoteController));
router.get('/:childId/access-logs', accessLogController.list.bind(accessLogController));
router.post('/:childId/caregivers', caregiverShareController.invite.bind(caregiverShareController));
router.get('/:childId/caregivers', caregiverShareController.list.bind(caregiverShareController));
router.delete('/:childId/caregivers/:id', caregiverShareController.revoke.bind(caregiverShareController));
router.get('/:id', controller.get.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
