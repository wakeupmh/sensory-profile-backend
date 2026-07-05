import { UserProfileRepository } from '../../domain/repositories/UserProfileRepository';
import { ReminderNotificationRepository } from '../../domain/repositories/ReminderNotificationRepository';
import { UpcomingReminderService, UpcomingReminderItem } from './UpcomingReminderService';
import { EmailService } from '../../infrastructure/email/EmailService';
import logger from '../../infrastructure/utils/logger';

// Reminders due within this window get emailed. Matches the default
// "upcoming" horizon the frontend widget shows, so a daily digest run
// catches everything a user would see if they opened the app today.
const NOTIFY_WINDOW_DAYS = 3;

export interface ReminderDigestResult {
  usersChecked: number;
  usersNotified: number;
  emailsSent: number;
  emailsFailed: number;
}

function reminderKey(item: UpcomingReminderItem): string {
  return `${item.source}:${item.type}:${item.id}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function buildDigestEmail(items: UpcomingReminderItem[]): { subject: string; body: string } {
  const subject =
    items.length === 1
      ? 'Você tem 1 lembrete próximo'
      : `Você tem ${items.length} lembretes próximos`;

  const lines = items
    .slice()
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((item) => `- ${item.title} — ${formatDate(item.dueAt)}`);

  const body = `Olá!

Aqui estão os lembretes que vencem nos próximos dias:

${lines.join('\n')}

Acesse o app para ver mais detalhes ou marcar como concluído.

Você pode desativar esses e-mails a qualquer momento nas preferências de notificação.`;

  return { subject, body };
}

/**
 * Turns the pull-based /api/reminders/upcoming feed into a push (email)
 * notification. Meant to be run on a schedule (see reminderDigestRoutes.ts)
 * — this service itself has no timer, it just does one pass over eligible
 * users when called.
 */
export class ReminderDigestService {
  constructor(
    private readonly userProfileRepo: UserProfileRepository,
    private readonly notificationRepo: ReminderNotificationRepository,
    private readonly upcomingReminderService: UpcomingReminderService,
    private readonly emailService: EmailService,
  ) {}

  async run(): Promise<ReminderDigestResult> {
    const eligibleProfiles = await this.userProfileRepo.findAllEligibleForReminders();
    const result: ReminderDigestResult = {
      usersChecked: eligibleProfiles.length,
      usersNotified: 0,
      emailsSent: 0,
      emailsFailed: 0,
    };

    for (const profile of eligibleProfiles) {
      const userId = profile.getUserId();
      const email = profile.getEmail();
      if (!email) continue; // findAllEligibleForReminders already filters this, but keep the type honest

      try {
        const items = await this.upcomingReminderService.getUpcoming(userId, undefined, NOTIFY_WINDOW_DAYS);
        const unsent: UpcomingReminderItem[] = [];

        // Reserve each reminder key up front — this is what makes the digest
        // safe to run concurrently or retry without double-emailing.
        for (const item of items) {
          const key = reminderKey(item);
          const reserved = await this.notificationRepo.reserve(userId, key);
          if (reserved) unsent.push(item);
        }

        if (unsent.length === 0) continue;

        const { subject, body } = buildDigestEmail(unsent);
        try {
          await this.emailService.sendEmail(email, subject, body);
          result.usersNotified += 1;
          result.emailsSent += 1;
        } catch (sendError) {
          // Sending failed after reserving — release so the next run retries
          // these instead of silently losing them forever.
          await Promise.all(unsent.map((item) => this.notificationRepo.release(userId, reminderKey(item))));
          result.emailsFailed += 1;
          logger.warn('[ReminderDigestService] failed to send digest email', {
            userId,
            error: sendError instanceof Error ? sendError.message : String(sendError),
          });
        }
      } catch (error) {
        logger.error('[ReminderDigestService] failed to process user', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }
}
