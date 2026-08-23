import { Pool } from 'pg';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import logger from '../../infrastructure/utils/logger';

const DEFAULT_ACCESS_LOG_RETENTION_DAYS = 180;
const DEFAULT_REMINDER_NOTIFICATION_RETENTION_DAYS = 90;

export interface RetentionCleanupResult {
  accessLogsDeleted: number;
  reminderNotificationsDeleted: number;
  dailyReportAudiosExpired: number;
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
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService = new S3StorageService(),
  ) {}

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
      dailyReportAudiosExpired: await this.expireDailyReportAudio(),
    };
  }

  /**
   * The spoken daily report keeps its original recording for a window
   * (DailyReportService.AUDIO_RETENTION_DAYS) so the caregiver can re-listen
   * or a bad transcription can be re-run. After that the audio and the raw
   * Transcribe JSON are deleted — the report itself (transcript + structured
   * output) is the durable record and stays.
   *
   * Rows still `transcribing` are skipped: the job is actively reading those
   * objects, and a stalled job is a far smaller problem than deleting the
   * input out from under a running one.
   */
  private async expireDailyReportAudio(): Promise<number> {
    const { rows } = await this.pool.query<{
      id: string;
      audio_storage_key: string | null;
      transcript_key: string | null;
    }>(
      `SELECT id, audio_storage_key, transcript_key
         FROM daily_reports
        WHERE audio_storage_key IS NOT NULL
          AND audio_expires_at IS NOT NULL
          AND audio_expires_at < NOW()
          AND status <> 'transcribing'`,
    );
    if (rows.length === 0) return 0;

    let expired = 0;
    for (const row of rows) {
      const keys = [row.audio_storage_key, row.transcript_key].filter((k): k is string => k !== null);
      const results = await Promise.allSettled(keys.map((key) => this.storage.deleteObject(key)));
      // Só limpa as colunas quando o objeto realmente saiu do S3; caso
      // contrário a linha perderia a única referência à chave e o arquivo
      // ficaria órfão no bucket para sempre. Falhou? Tenta de novo na
      // próxima execução.
      if (results.some((r) => r.status === 'rejected')) {
        logger.warn('[RetentionCleanup] failed to delete daily report audio', { reportId: row.id });
        continue;
      }
      await this.pool.query(
        `UPDATE daily_reports
            SET audio_storage_key = NULL, audio_mime_type = NULL, audio_expires_at = NULL, transcript_key = NULL
          WHERE id = $1`,
        [row.id],
      );
      expired += 1;
    }
    return expired;
  }
}
