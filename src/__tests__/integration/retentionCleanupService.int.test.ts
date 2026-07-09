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
 */

import { Pool } from 'pg';
import { RetentionCleanupService } from 'application/services/RetentionCleanupService';

function makePool(accessLogsDeleted = 0, reminderNotificationsDeleted = 0) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM access_logs')) return Promise.resolve({ rows: [], rowCount: accessLogsDeleted });
    if (sql.includes('FROM reminder_notifications')) return Promise.resolve({ rows: [], rowCount: reminderNotificationsDeleted });
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

    expect(result).toEqual({ accessLogsDeleted: 42, reminderNotificationsDeleted: 7 });
  });
});
