import { UserProfileRepository } from '../../domain/repositories/UserProfileRepository';
import { ReminderNotificationRepository } from '../../domain/repositories/ReminderNotificationRepository';
import { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';
import { PushSubscription } from '../../domain/entities/PushSubscription';
import { UpcomingReminderService, UpcomingReminderItem } from './UpcomingReminderService';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WebPushService, PushSubscriptionGoneError } from '../../infrastructure/push/WebPushService';
import logger from '../../infrastructure/utils/logger';

// Reminders due within this window get notified. Matches the default
// "upcoming" horizon the frontend widget shows, so a daily digest run
// catches everything a user would see if they opened the app today.
const NOTIFY_WINDOW_DAYS = 3;

export interface ReminderDigestResult {
  usersChecked: number;
  usersNotified: number;
  emailsSent: number;
  emailsFailed: number;
  pushSent: number;
  pushFailed: number;
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

function buildDigestPush(items: UpcomingReminderItem[]): { title: string; body: string } {
  const title =
    items.length === 1
      ? 'Você tem 1 lembrete próximo'
      : `Você tem ${items.length} lembretes próximos`;
  const body = items
    .slice()
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((item) => `${item.title} — ${formatDate(item.dueAt)}`)
    .join(' · ');
  return { title, body };
}

/**
 * Turns the pull-based /api/reminders/upcoming feed into push (email and/or
 * Web Push) notifications. Meant to be run on a schedule (see
 * reminderDigestRoutes.ts) — this service itself has no timer, it just does
 * one pass over eligible users when called.
 */
export class ReminderDigestService {
  constructor(
    private readonly userProfileRepo: UserProfileRepository,
    private readonly notificationRepo: ReminderNotificationRepository,
    private readonly upcomingReminderService: UpcomingReminderService,
    private readonly emailService: EmailService,
    private readonly pushSubscriptionRepo: PushSubscriptionRepository,
    private readonly webPushService: WebPushService,
  ) {}

  async run(): Promise<ReminderDigestResult> {
    const eligibleProfiles = await this.userProfileRepo.findAllEligibleForReminders();
    const pushSubscriptionsByUser = await this.groupPushSubscriptionsByUser();
    // A user with an active push subscription but no known/opted-in email
    // still needs to be walked so their push channel gets a chance to fire.
    const userIds = new Set<string>([
      ...eligibleProfiles.map((p) => p.getUserId()),
      ...pushSubscriptionsByUser.keys(),
    ]);
    const emailByUser = new Map(eligibleProfiles.map((p) => [p.getUserId(), p.getEmail()]));

    const result: ReminderDigestResult = {
      usersChecked: userIds.size,
      usersNotified: 0,
      emailsSent: 0,
      emailsFailed: 0,
      pushSent: 0,
      pushFailed: 0,
    };

    for (const userId of userIds) {
      try {
        const items = await this.upcomingReminderService.getUpcoming(userId, undefined, NOTIFY_WINDOW_DAYS);
        if (items.length === 0) continue;

        let notified = false;

        const email = emailByUser.get(userId);
        if (email) {
          const sent = await this.sendEmailChannel(userId, email, items, result);
          notified = notified || sent;
        }

        const subscriptions = pushSubscriptionsByUser.get(userId) ?? [];
        if (subscriptions.length > 0) {
          const sent = await this.sendPushChannel(userId, subscriptions, items, result);
          notified = notified || sent;
        }

        if (notified) result.usersNotified += 1;
      } catch (error) {
        logger.error('[ReminderDigestService] failed to process user', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  private async groupPushSubscriptionsByUser(): Promise<Map<string, PushSubscription[]>> {
    const all = await this.pushSubscriptionRepo.findAll();
    const byUser = new Map<string, PushSubscription[]>();
    for (const sub of all) {
      const list = byUser.get(sub.getUserId()) ?? [];
      list.push(sub);
      byUser.set(sub.getUserId(), list);
    }
    return byUser;
  }

  private async sendEmailChannel(
    userId: string,
    email: string,
    items: UpcomingReminderItem[],
    result: ReminderDigestResult,
  ): Promise<boolean> {
    const unsent: UpcomingReminderItem[] = [];
    for (const item of items) {
      const key = reminderKey(item);
      const reserved = await this.notificationRepo.reserve(userId, key, 'email');
      if (reserved) unsent.push(item);
    }
    if (unsent.length === 0) return false;

    const { subject, body } = buildDigestEmail(unsent);
    try {
      await this.emailService.sendEmail(email, subject, body);
      result.emailsSent += 1;
      return true;
    } catch (sendError) {
      // Sending failed after reserving — release so the next run retries
      // these instead of silently losing them forever.
      await Promise.all(unsent.map((item) => this.notificationRepo.release(userId, reminderKey(item), 'email')));
      result.emailsFailed += 1;
      logger.warn('[ReminderDigestService] failed to send digest email', {
        userId,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
      return false;
    }
  }

  private async sendPushChannel(
    userId: string,
    subscriptions: PushSubscription[],
    items: UpcomingReminderItem[],
    result: ReminderDigestResult,
  ): Promise<boolean> {
    const unsent: UpcomingReminderItem[] = [];
    for (const item of items) {
      const key = reminderKey(item);
      const reserved = await this.notificationRepo.reserve(userId, key, 'push');
      if (reserved) unsent.push(item);
    }
    if (unsent.length === 0) return false;

    const payload = buildDigestPush(unsent);
    let anySent = false;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await this.webPushService.send(
            { endpoint: sub.getEndpoint(), keys: { p256dh: sub.getP256dhKey(), auth: sub.getAuthKey() } },
            payload,
          );
          anySent = true;
        } catch (sendError) {
          if (sendError instanceof PushSubscriptionGoneError) {
            await this.pushSubscriptionRepo.deleteById(sub.getId());
            return;
          }
          logger.warn('[ReminderDigestService] failed to send push notification', {
            userId,
            error: sendError instanceof Error ? sendError.message : String(sendError),
          });
        }
      }),
    );

    if (anySent) {
      result.pushSent += 1;
    } else {
      // No device reachable — release so the next run retries instead of losing these forever.
      await Promise.all(unsent.map((item) => this.notificationRepo.release(userId, reminderKey(item), 'push')));
      result.pushFailed += 1;
    }
    return anySent;
  }
}
