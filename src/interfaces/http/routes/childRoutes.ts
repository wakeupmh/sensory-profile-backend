import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { ChildController } from '../controllers/ChildController';
import { ChildService } from '../../../application/services/ChildService';
import { PgChildRepository } from '../../../infrastructure/repositories/PgChildRepository';

const repo = new PgChildRepository();
const service = new ChildService(repo);
const controller = new ChildController(service);

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list.bind(controller));
router.get('/:id', controller.get.bind(controller));
router.post('/', controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
