import { Router } from 'express';
import pool from '../../../infrastructure/database/connection';

import { ReminderDigestController } from '../controllers/ReminderDigestController';
import { ReminderDigestService } from '../../../application/services/ReminderDigestService';
import { UpcomingReminderService } from '../../../application/services/UpcomingReminderService';
import { EmailService } from '../../../infrastructure/email/EmailService';
import { PgReminderRepository } from '../../../infrastructure/repositories/PgReminderRepository';
import { PgReminderNotificationRepository } from '../../../infrastructure/repositories/PgReminderNotificationRepository';
import { userProfileRepository } from './notificationPreferencesRoutes';

const reminderRepository = new PgReminderRepository();
const upcomingReminderService = new UpcomingReminderService(pool, reminderRepository);
const reminderNotificationRepository = new PgReminderNotificationRepository();
const emailService = new EmailService();

const digestService = new ReminderDigestService(
  userProfileRepository,
  reminderNotificationRepository,
  upcomingReminderService,
  emailService,
);
const controller = new ReminderDigestController(digestService);

// No authMiddleware — triggered by an external scheduler, gated by
// CRON_SECRET inside the controller instead of a user session.
const router = Router();
router.post('/', controller.run.bind(controller));

export default router;
