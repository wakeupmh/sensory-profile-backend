import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../../../infrastructure/database/connection';

import { ReminderController } from '../controllers/ReminderController';
import { ReminderService } from '../../../application/services/ReminderService';
import { UpcomingReminderService } from '../../../application/services/UpcomingReminderService';
import { PgReminderRepository } from '../../../infrastructure/repositories/PgReminderRepository';

const reminderRepository = new PgReminderRepository();
const reminderService = new ReminderService(reminderRepository);
const upcomingReminderService = new UpcomingReminderService(pool, reminderRepository);
const reminderController = new ReminderController(reminderService, upcomingReminderService);

const router = Router();

router.use(authMiddleware);

// Registered before '/:id' for readability (two segments, no path collision).
router.get('/upcoming', reminderController.getUpcoming.bind(reminderController));

router.get('/', reminderController.list.bind(reminderController));
router.post('/', reminderController.create.bind(reminderController));
router.get('/:id', reminderController.getById.bind(reminderController));
router.patch('/:id', reminderController.update.bind(reminderController));
router.delete('/:id', reminderController.remove.bind(reminderController));

export default router;
