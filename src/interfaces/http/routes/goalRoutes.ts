import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';

import { GoalController } from '../controllers/GoalController';
import { GoalService } from '../../../application/services/GoalService';
import { PgGoalRepository } from '../../../infrastructure/repositories/PgGoalRepository';

import { GoalProgressController } from '../controllers/GoalProgressController';
import { GoalProgressService } from '../../../application/services/GoalProgressService';
import { PgGoalProgressEntryRepository } from '../../../infrastructure/repositories/PgGoalProgressEntryRepository';

const goalRepository = new PgGoalRepository();
const goalService = new GoalService(goalRepository);
const goalController = new GoalController(goalService);

const goalProgressRepository = new PgGoalProgressEntryRepository();
const goalProgressService = new GoalProgressService(goalProgressRepository, goalRepository);
const goalProgressController = new GoalProgressController(goalProgressService);

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);

router.get('/', goalController.list.bind(goalController));
router.post('/', goalController.create.bind(goalController));
router.get('/:id', goalController.getById.bind(goalController));
router.patch('/:id', goalController.update.bind(goalController));
router.delete('/:id', goalController.remove.bind(goalController));

router.get('/:goalId/progress', goalProgressController.list.bind(goalProgressController));
router.post('/:goalId/progress', goalProgressController.create.bind(goalProgressController));
router.get('/:goalId/progress/summary', goalProgressController.getSummary.bind(goalProgressController));
router.delete('/:goalId/progress/:entryId', goalProgressController.remove.bind(goalProgressController));

export default router;
