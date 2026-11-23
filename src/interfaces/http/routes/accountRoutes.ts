import { Router } from 'express';
import { accountExportLimiter } from '../middleware/rateLimiters';
import { authMiddleware } from '../middleware/authMiddleware';
import { accountController as controller } from './childRoutes';
import { ConsentController } from '../controllers/ConsentController';
import { ConsentService } from '../../../application/services/ConsentService';
import { PgConsentRepository } from '../../../infrastructure/repositories/PgConsentRepository';

const consentController = new ConsentController(new ConsentService(new PgConsentRepository()));

// Deliberately no delegationMiddleware — account-level export/erasure must
// only ever operate on the caller's own identity (see requireOwnUserId in
// AccountController), never a delegated owner's.
const router = Router();
router.use(authMiddleware);

router.get('/export', accountExportLimiter, controller.exportAccount.bind(controller));
router.delete('/', controller.eraseAccount.bind(controller));
router.get('/consent', consentController.getConsent);
router.post('/consent', consentController.acceptConsent);

export default router;
