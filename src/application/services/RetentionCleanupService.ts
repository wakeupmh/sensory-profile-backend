import { Pool } from 'pg';

const DEFAULT_ACCESS_LOG_RETENTION_DAYS = 180;
const DEFAULT_REMINDER_NOTIFICATION_RETENTION_DAYS = 90;

export interface RetentionCleanupResult {
  accessLogsDeleted: number;
  reminderNotificationsDeleted: number;
}

function retentionDays(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * access_logs and reminder_notifications have no retention policy today —
 * both grow forever, which sits awkwardly with LGPD's data-minimization
 * principle (Art. 6 III) even though neither is core clinical data.
 * access_logs is the caregiver-facing audit trail ("who looked at this
 * child's data") so it gets a generous default (6 months); reminder
 * notifications are purely a dedup guard against re-sending an already-sent
 * reminder and are safe to drop much sooner.
 *
 * Triggered by an external scheduler the same way ReminderDigestService is
 * — see RetentionCleanupController.
 */
export class RetentionCleanupService {
  constructor(private readonly pool: Pool) {}

  async run(): Promise<RetentionCleanupResult> {
    const accessLogDays = retentionDays('ACCESS_LOG_RETENTION_DAYS', DEFAULT_ACCESS_LOG_RETENTION_DAYS);
    const reminderNotificationDays = retentionDays(
      'REMINDER_NOTIFICATION_RETENTION_DAYS',
      DEFAULT_REMINDER_NOTIFICATION_RETENTION_DAYS,
    );

    const [accessLogsResult, reminderNotificationsResult] = await Promise.all([
      this.pool.query(`DELETE FROM access_logs WHERE created_at < NOW() - ($1 || ' days')::interval`, [accessLogDays]),
      this.pool.query(`DELETE FROM reminder_notifications WHERE sent_at < NOW() - ($1 || ' days')::interval`, [
        reminderNotificationDays,
      ]),
    ]);

    return {
      accessLogsDeleted: accessLogsResult.rowCount ?? 0,
      reminderNotificationsDeleted: reminderNotificationsResult.rowCount ?? 0,
    };
  }
}
