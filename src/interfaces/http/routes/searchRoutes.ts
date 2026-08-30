import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { delegationMiddleware } from './childRoutes';
import { careTeamScopeMiddleware } from '../middleware/careTeamScopeMiddleware';
import pool from '../../../infrastructure/database/connection';

import { SearchController } from '../controllers/SearchController';
import { SearchService } from '../../../application/services/SearchService';

const searchService = new SearchService(pool);
const controller = new SearchController(searchService);

const router = Router();

router.use(authMiddleware);
router.use(delegationMiddleware);
router.use(careTeamScopeMiddleware);

router.get('/', controller.search.bind(controller));

export default router;
