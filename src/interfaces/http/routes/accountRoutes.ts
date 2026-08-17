import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { accountController as controller } from './childRoutes';

// Deliberately no delegationMiddleware — account-level export/erasure must
// only ever operate on the caller's own identity (see requireOwnUserId in
// AccountController), never a delegated owner's.
const router = Router();
router.use(authMiddleware);

router.get('/export', controller.exportAccount.bind(controller));
router.delete('/', controller.eraseAccount.bind(controller));

export default router;
