/**
 * Real-Postgres integration test for PgDailyLogRepository.findAllByUser.
 *
 * dailyLog.int.test.ts exercises DailyLogService against a fully mocked
 * repository, so the actual from/to SQL (buildWhere in queryUtils.ts) has
 * never run against a real database. This file seeds real rows and queries
 * through the repository directly to verify:
 *
 *  1. from/to together return only logs within [from, to] (inclusive)
 *  2. from alone excludes everything before it
 *  3. to alone excludes everything after it
 *  4. omitting both returns all logs for the child
 *  5. limit is capped at 100 server-side even when more logs exist in range,
 *     and `total` still reports the true count — callers that assume a
 *     single call returns everything (e.g. a monthly recap) will silently
 *     get a truncated first page instead of an error
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { PgDailyLogRepository } from 'infrastructure/repositories/PgDailyLogRepository';

const USER_ID = `test-user-${uuidv7()}`;
const CHILD_ID = uuidv7();

const repo = new PgDailyLogRepository();

function isoDaysAgo(days: number): string {
  const base = new Date('2024-06-15T12:00:00.000Z');
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString();
}

async function insertLog(occurredAt: string): Promise<string> {
  const id = uuidv7();
  await pool.query(
    `INSERT INTO daily_logs (id, user_id, child_id, log_type, occurred_at, data, notes)
     VALUES ($1, $2, $3, 'mood', $4, '{}'::jsonb, NULL)`,
    [id, USER_ID, CHILD_ID, occurredAt],
  );
  return id;
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id, name, user_id) VALUES ($1, 'Test Child', $2)`,
    [CHILD_ID, USER_ID],
  );
  // 5 logs spread across day 0 (most recent), 5, 10, 15, 20 days ago.
  await Promise.all([0, 5, 10, 15, 20].map((days) => insertLog(isoDaysAgo(days))));
});

afterAll(async () => {
  await pool.query(`DELETE FROM daily_logs WHERE user_id = $1`, [USER_ID]);
  await pool.query(`DELETE FROM children WHERE id = $1`, [CHILD_ID]);
  await pool.end();
});

describe('PgDailyLogRepository.findAllByUser — from/to filtering (real Postgres)', () => {
  test('from + to together return only logs within the inclusive range', async () => {
    const result = await repo.findAllByUser(USER_ID, {
      childId: CHILD_ID,
      from: new Date(isoDaysAgo(15)),
      to: new Date(isoDaysAgo(5)),
      page: 1,
      limit: 20,
    });

    // Expect the 15, 10, and 5 day-ago logs — not 0 or 20.
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
    const daysAgo = result.data.map((d) => Math.round(
      (new Date(isoDaysAgo(0)).getTime() - d.occurredAt.getTime()) / (24 * 60 * 60 * 1000),
    ));
    expect(daysAgo.sort((a, b) => a - b)).toEqual([5, 10, 15]);
  });

  test('from alone excludes everything before it', async () => {
    const result = await repo.findAllByUser(USER_ID, {
      childId: CHILD_ID,
      from: new Date(isoDaysAgo(10)),
      page: 1,
      limit: 20,
    });

    // 10, 5, 0 days ago — not 15 or 20.
    expect(result.total).toBe(3);
  });

  test('to alone excludes everything after it', async () => {
    const result = await repo.findAllByUser(USER_ID, {
      childId: CHILD_ID,
      to: new Date(isoDaysAgo(10)),
      page: 1,
      limit: 20,
    });

    // 20, 15, 10 days ago — not 5 or 0.
    expect(result.total).toBe(3);
  });

  test('omitting from/to returns all logs for the child', async () => {
    const result = await repo.findAllByUser(USER_ID, {
      childId: CHILD_ID,
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(5);
    expect(result.data).toHaveLength(5);
  });

  test('a range with no matching logs returns zero results, not everything', async () => {
    const result = await repo.findAllByUser(USER_ID, {
      childId: CHILD_ID,
      from: new Date(isoDaysAgo(4)),
      to: new Date(isoDaysAgo(1)),
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});

describe('PgDailyLogRepository.findAllByUser — page size cap (real Postgres)', () => {
  const MANY_USER_ID = `test-user-many-${uuidv7()}`;
  const MANY_CHILD_ID = uuidv7();
  const MONTH_LOG_COUNT = 200;

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO children (id, name, user_id) VALUES ($1, 'Many Logs Child', $2)`,
      [MANY_CHILD_ID, MANY_USER_ID],
    );
    // 200 logs across the last 30 days — more than the old 100-row page cap,
    // all within a single "fetch one month" query a page like MonthlyRecap
    // would issue with limit=1000.
    const inserts = Array.from({ length: MONTH_LOG_COUNT }, (_, i) => {
      const occurredAt = new Date('2024-06-15T12:00:00.000Z');
      occurredAt.setUTCHours(occurredAt.getUTCHours() - i * 3.6); // spans ~30 days
      return pool.query(
        `INSERT INTO daily_logs (id, user_id, child_id, log_type, occurred_at, data, notes)
         VALUES ($1, $2, $3, 'mood', $4, '{}'::jsonb, NULL)`,
        [uuidv7(), MANY_USER_ID, MANY_CHILD_ID, occurredAt.toISOString()],
      );
    });
    await Promise.all(inserts);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM daily_logs WHERE user_id = $1`, [MANY_USER_ID]);
    await pool.query(`DELETE FROM children WHERE id = $1`, [MANY_CHILD_ID]);
  });

  test('a whole month of logs (200, more than the old 100-row cap) all come back in one page with limit=1000', async () => {
    const from = new Date('2024-06-15T12:00:00.000Z');
    from.setUTCDate(from.getUTCDate() - 31);

    const result = await repo.findAllByUser(MANY_USER_ID, {
      childId: MANY_CHILD_ID,
      from,
      to: new Date('2024-06-15T12:00:00.000Z'),
      page: 1,
      limit: 1000, // caller (e.g. a monthly recap) asking for "everything in one page"
    });

    expect(result.total).toBe(MONTH_LOG_COUNT);
    expect(result.data).toHaveLength(MONTH_LOG_COUNT);
    expect(result.limit).toBe(1000);
  });

  test('the effective limit is still clamped to 1000 even if a caller requests more', async () => {
    const result = await repo.findAllByUser(MANY_USER_ID, {
      childId: MANY_CHILD_ID,
      page: 1,
      limit: 5000,
    });

    // Only MONTH_LOG_COUNT rows actually exist, so this doesn't prove
    // truncation by itself, but it does prove the clamp math still applies
    // a ceiling rather than passing an unbounded LIMIT straight to Postgres.
    expect(result.limit).toBe(1000);
  });
});
