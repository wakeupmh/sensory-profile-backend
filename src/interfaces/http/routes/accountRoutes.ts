import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { AccountController } from '../controllers/AccountController';
import { exportService, erasureService } from './childRoutes';

const controller = new AccountController(exportService, erasureService);

// Deliberately no delegationMiddleware — account-level export/erasure must
// only ever operate on the caller's own identity (see requireOwnUserId in
// AccountController), never a delegated owner's.
const router = Router();
router.use(authMiddleware);

router.get('/export', controller.exportAccount.bind(controller));
router.delete('/', controller.eraseAccount.bind(controller));

export default router;
