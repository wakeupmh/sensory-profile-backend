import { Router } from 'express';
import pool from '../../../infrastructure/database/connection';

import { ReminderDigestController } from '../controllers/ReminderDigestController';
import { ReminderDigestService } from '../../../application/services/ReminderDigestService';
import { UpcomingReminderService } from '../../../application/services/UpcomingReminderService';
import { EmailService } from '../../../infrastructure/email/EmailService';
import { PgReminderRepository } from '../../../infrastructure/repositories/PgReminderRepository';
import { PgReminderNotificationRepository } from '../../../infrastructure/repositories/PgReminderNotificationRepository';
import { userProfileRepository } from './notificationPreferencesRoutes';
import { cronAuthMiddleware } from '../middleware/cronAuthMiddleware';
import { pushSubscriptionRepository, webPushService } from './pushSubscriptionRoutes';

const reminderRepository = new PgReminderRepository();
const upcomingReminderService = new UpcomingReminderService(pool, reminderRepository);
const reminderNotificationRepository = new PgReminderNotificationRepository();
const emailService = new EmailService();

const digestService = new ReminderDigestService(
  userProfileRepository,
  reminderNotificationRepository,
  upcomingReminderService,
  emailService,
  pushSubscriptionRepository,
  webPushService,
);
const controller = new ReminderDigestController(digestService);

const router = Router();
// Autenticado por segredo compartilhado (CRON_SECRET), não por sessão de
// usuário: quem chama é um agendador externo, não uma pessoa logada.
router.use(cronAuthMiddleware);
router.post('/', controller.run.bind(controller));

export default router;
