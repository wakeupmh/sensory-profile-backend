/**
 * Integration tests for RetentionCleanupService.
 *
 * Tests exercise the service against a mock pg Pool — no real database
 * connection required.
 *
 * Covers:
 *  1.  run() deletes from access_logs and reminder_notifications
 *  2.  run() uses the default retention windows (180 / 90 days) when no env vars are set
 *  3.  run() honors ACCESS_LOG_RETENTION_DAYS / REMINDER_NOTIFICATION_RETENTION_DAYS overrides
 *  4.  run() falls back to defaults for a non-numeric or non-positive env var
 *  5.  run() returns the rowCount from each DELETE
 *  6.  run() expires daily report audio only after the S3 object is really gone
 */

import { Pool } from 'pg';
import { RetentionCleanupService } from 'application/services/RetentionCleanupService';

function makePool(accessLogsDeleted = 0, reminderNotificationsDeleted = 0) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM access_logs')) return Promise.resolve({ rows: [], rowCount: accessLogsDeleted });
    if (sql.includes('FROM reminder_notifications')) return Promise.resolve({ rows: [], rowCount: reminderNotificationsDeleted });
    if (sql.includes('FROM daily_reports')) return Promise.resolve({ rows: [], rowCount: 0 });
    if (sql.includes('FROM voice_notes')) return Promise.resolve({ rows: [], rowCount: 0 });
    throw new Error(`Unexpected query: ${sql}`);
  });
  const pool = { query: mockQuery } as unknown as Pool;
  return { pool, calls };
}

describe('RetentionCleanupService', () => {
  const originalAccessLogDays = process.env.ACCESS_LOG_RETENTION_DAYS;
  const originalReminderDays = process.env.REMINDER_NOTIFICATION_RETENTION_DAYS;

  afterEach(() => {
    if (originalAccessLogDays === undefined) delete process.env.ACCESS_LOG_RETENTION_DAYS;
    else process.env.ACCESS_LOG_RETENTION_DAYS = originalAccessLogDays;
    if (originalReminderDays === undefined) delete process.env.REMINDER_NOTIFICATION_RETENTION_DAYS;
    else process.env.REMINDER_NOTIFICATION_RETENTION_DAYS = originalReminderDays;
  });

  test('deletes from access_logs and reminder_notifications', async () => {
    delete process.env.ACCESS_LOG_RETENTION_DAYS;
    delete process.env.REMINDER_NOTIFICATION_RETENTION_DAYS;
    const { pool, calls } = makePool();
    const service = new RetentionCleanupService(pool);

    await service.run();

    expect(calls.some((c) => c.sql.includes('DELETE FROM access_logs'))).toBe(true);
    expect(calls.some((c) => c.sql.includes('DELETE FROM reminder_notifications'))).toBe(true);
  });

  test('uses the default retention windows when no env vars are set', async () => {
    delete process.env.ACCESS_LOG_RETENTION_DAYS;
    delete process.env.REMINDER_NOTIFICATION_RETENTION_DAYS;
    const { pool, calls } = makePool();
    const service = new RetentionCleanupService(pool);

    await service.run();

    const accessLogCall = calls.find((c) => c.sql.includes('FROM access_logs'));
    const reminderCall = calls.find((c) => c.sql.includes('FROM reminder_notifications'));
    expect(accessLogCall?.params).toEqual([180]);
    expect(reminderCall?.params).toEqual([90]);
  });

  test('honors retention-day env var overrides', async () => {
    process.env.ACCESS_LOG_RETENTION_DAYS = '30';
    process.env.REMINDER_NOTIFICATION_RETENTION_DAYS = '14';
    const { pool, calls } = makePool();
    const service = new RetentionCleanupService(pool);

    await service.run();

    const accessLogCall = calls.find((c) => c.sql.includes('FROM access_logs'));
    const reminderCall = calls.find((c) => c.sql.includes('FROM reminder_notifications'));
    expect(accessLogCall?.params).toEqual([30]);
    expect(reminderCall?.params).toEqual([14]);
  });

  test('falls back to defaults for a non-numeric or non-positive env var', async () => {
    process.env.ACCESS_LOG_RETENTION_DAYS = 'not-a-number';
    process.env.REMINDER_NOTIFICATION_RETENTION_DAYS = '-5';
    const { pool, calls } = makePool();
    const service = new RetentionCleanupService(pool);

    await service.run();

    const accessLogCall = calls.find((c) => c.sql.includes('FROM access_logs'));
    const reminderCall = calls.find((c) => c.sql.includes('FROM reminder_notifications'));
    expect(accessLogCall?.params).toEqual([180]);
    expect(reminderCall?.params).toEqual([90]);
  });

  test('returns the rowCount from each DELETE', async () => {
    const { pool } = makePool(42, 7);
    const service = new RetentionCleanupService(pool);

    const result = await service.run();

    expect(result).toEqual({ accessLogsDeleted: 42, reminderNotificationsDeleted: 7, dailyReportAudiosExpired: 0, voiceNotesDeleted: 0 });
  });
});

describe('RetentionCleanupService — daily report audio expiry', () => {
  function makeAudioPool(rows: Array<{ id: string; audio_storage_key: string | null; transcript_key: string | null }>) {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM access_logs')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('FROM reminder_notifications')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('FROM voice_notes')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('SELECT id, audio_storage_key')) return Promise.resolve({ rows, rowCount: rows.length });
      if (sql.includes('UPDATE daily_reports')) return Promise.resolve({ rows: [], rowCount: 1 });
      throw new Error(`Unexpected query: ${sql}`);
    });
    return { pool: { query: mockQuery } as unknown as Pool, calls };
  }

  function makeStorage(deleteObject: jest.Mock) {
    return { deleteObject } as unknown as import('infrastructure/storage/S3StorageService').S3StorageService;
  }

  test('deletes both the audio and the transcript JSON, then clears the columns', async () => {
    const { pool, calls } = makeAudioPool([
      { id: 'r1', audio_storage_key: 'daily-reports/u/r1/audio.webm', transcript_key: 'daily-reports/u/r1/t.json' },
    ]);
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const service = new RetentionCleanupService(pool, makeStorage(deleteObject));

    const result = await service.run();

    expect(deleteObject).toHaveBeenCalledWith('daily-reports/u/r1/audio.webm');
    expect(deleteObject).toHaveBeenCalledWith('daily-reports/u/r1/t.json');
    expect(calls.some((c) => c.sql.includes('UPDATE daily_reports') && c.params[0] === 'r1')).toBe(true);
    expect(result.dailyReportAudiosExpired).toBe(1);
  });

  test('leaves the row untouched when S3 deletion fails, so the key is retried instead of orphaned', async () => {
    const { pool, calls } = makeAudioPool([
      { id: 'r1', audio_storage_key: 'daily-reports/u/r1/audio.webm', transcript_key: null },
    ]);
    const deleteObject = jest.fn().mockRejectedValue(new Error('S3 down'));
    const service = new RetentionCleanupService(pool, makeStorage(deleteObject));

    const result = await service.run();

    expect(calls.some((c) => c.sql.includes('UPDATE daily_reports'))).toBe(false);
    expect(result.dailyReportAudiosExpired).toBe(0);
  });

  test('skips rows still transcribing', async () => {
    const { pool, calls } = makeAudioPool([]);
    const service = new RetentionCleanupService(pool, makeStorage(jest.fn()));

    await service.run();

    const select = calls.find((c) => c.sql.includes('SELECT id, audio_storage_key'));
    expect(select?.sql).toContain("status <> 'transcribing'");
  });
});

describe('RetentionCleanupService — voice note cleanup', () => {
  function makeVoicePool(rows: Array<{ id: string; audio_storage_key: string | null; transcript_key: string | null }>) {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM access_logs')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('FROM reminder_notifications')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('FROM daily_reports')) return Promise.resolve({ rows: [], rowCount: 0 });
      if (sql.includes('DELETE FROM voice_notes')) return Promise.resolve({ rows: [], rowCount: rows.length });
      if (sql.includes('FROM voice_notes')) return Promise.resolve({ rows, rowCount: rows.length });
      throw new Error(`Unexpected query: ${sql}`);
    });
    return { pool: { query: mockQuery } as unknown as Pool, calls };
  }

  function makeStorage(deleteObject: jest.Mock) {
    return { deleteObject } as unknown as import('infrastructure/storage/S3StorageService').S3StorageService;
  }

  const originalDays = process.env.VOICE_NOTE_RETENTION_DAYS;
  afterEach(() => {
    if (originalDays === undefined) delete process.env.VOICE_NOTE_RETENTION_DAYS;
    else process.env.VOICE_NOTE_RETENTION_DAYS = originalDays;
  });

  test('deletes abandoned dictations along with any audio still in the bucket', async () => {
    delete process.env.VOICE_NOTE_RETENTION_DAYS;
    const { pool, calls } = makeVoicePool([
      { id: 'v1', audio_storage_key: 'voice-notes/u/v1/audio.webm', transcript_key: null },
      // Já transcrito: o áudio saiu na hora, só a linha sobrou.
      { id: 'v2', audio_storage_key: null, transcript_key: null },
    ]);
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const service = new RetentionCleanupService(pool, makeStorage(deleteObject));

    const result = await service.run();

    expect(deleteObject).toHaveBeenCalledWith('voice-notes/u/v1/audio.webm');
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(result.voiceNotesDeleted).toBe(2);
    expect(calls.find((c) => c.sql.includes('DELETE FROM voice_notes'))?.params[0]).toBe(7);
  });

  test('deletes the rows even when S3 refuses, so a transcript is not kept indefinitely', async () => {
    const { pool, calls } = makeVoicePool([
      { id: 'v1', audio_storage_key: 'voice-notes/u/v1/audio.webm', transcript_key: null },
    ]);
    const service = new RetentionCleanupService(pool, makeStorage(jest.fn().mockRejectedValue(new Error('S3 down'))));

    const result = await service.run();

    expect(calls.some((c) => c.sql.includes('DELETE FROM voice_notes'))).toBe(true);
    expect(result.voiceNotesDeleted).toBe(1);
  });

  test('honors VOICE_NOTE_RETENTION_DAYS', async () => {
    process.env.VOICE_NOTE_RETENTION_DAYS = '2';
    const { pool, calls } = makeVoicePool([]);
    const service = new RetentionCleanupService(pool, makeStorage(jest.fn()));

    await service.run();

    expect(calls.find((c) => c.sql.includes('FROM voice_notes'))?.params[0]).toBe(2);
  });
});
