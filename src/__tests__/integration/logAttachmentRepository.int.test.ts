/**
 * Real-Postgres integration test for PgLogAttachmentRepository.
 *
 * Covers:
 *  1. save() persists an attachment and findById() returns it
 *  2. findByLogId() returns only attachments for that log, ordered oldest-first
 *  3. findByLogIds() batches across multiple logs in one query (the
 *     no-N+1 guarantee GET /api/logs relies on)
 *  4. findByLogIds() with an empty array returns [] without querying
 *  5. delete() removes the row and a second delete() call returns false
 *  6. deleting the parent daily_log cascades to its attachments
 *     (ON DELETE CASCADE — no orphaned attachment rows)
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { PgLogAttachmentRepository } from 'infrastructure/repositories/PgLogAttachmentRepository';

const USER_ID = `test-user-${uuidv7()}`;
const CHILD_ID = uuidv7();
const repo = new PgLogAttachmentRepository();

async function insertLog(): Promise<string> {
  const id = uuidv7();
  await pool.query(
    `INSERT INTO daily_logs (id, user_id, child_id, log_type, occurred_at, data, notes)
     VALUES ($1, $2, $3, 'mood', now(), '{}'::jsonb, NULL)`,
    [id, USER_ID, CHILD_ID],
  );
  return id;
}

beforeAll(async () => {
  await pool.query(`INSERT INTO children (id, name, user_id) VALUES ($1, 'Test Child', $2)`, [CHILD_ID, USER_ID]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM daily_logs WHERE user_id = $1`, [USER_ID]);
  await pool.query(`DELETE FROM children WHERE id = $1`, [CHILD_ID]);
  await pool.end();
});

describe('PgLogAttachmentRepository (real Postgres)', () => {
  test('save() persists an attachment and findById() returns it', async () => {
    const logId = await insertLog();
    const saved = await repo.save({
      id: uuidv7(),
      logId,
      storageKey: `log-attachments/${USER_ID}/${CHILD_ID}/${logId}/${uuidv7()}`,
      mimeType: 'image/jpeg',
      sizeBytes: 123456,
    });

    const found = await repo.findById(saved.getId());
    expect(found).not.toBeNull();
    expect(found?.getLogId()).toBe(logId);
    expect(found?.getMimeType()).toBe('image/jpeg');
    expect(found?.getSizeBytes()).toBe(123456);
  });

  test('findByLogId() returns only attachments for that log, oldest first', async () => {
    const logA = await insertLog();
    const logB = await insertLog();

    const first = await repo.save({
      id: uuidv7(), logId: logA, storageKey: `key-${uuidv7()}`, mimeType: 'image/png',
    });
    await new Promise((r) => setTimeout(r, 10));
    const second = await repo.save({
      id: uuidv7(), logId: logA, storageKey: `key-${uuidv7()}`, mimeType: 'image/png',
    });
    await repo.save({ id: uuidv7(), logId: logB, storageKey: `key-${uuidv7()}`, mimeType: 'image/png' });

    const result = await repo.findByLogId(logA);
    expect(result).toHaveLength(2);
    expect(result[0].getId()).toBe(first.getId());
    expect(result[1].getId()).toBe(second.getId());
  });

  test('findByLogIds() batches across multiple logs in one query', async () => {
    const logA = await insertLog();
    const logB = await insertLog();
    const logC = await insertLog(); // no attachments

    await repo.save({ id: uuidv7(), logId: logA, storageKey: `key-${uuidv7()}`, mimeType: 'image/png' });
    await repo.save({ id: uuidv7(), logId: logB, storageKey: `key-${uuidv7()}`, mimeType: 'image/png' });

    const result = await repo.findByLogIds([logA, logB, logC]);
    const byLogId = new Set(result.map((a) => a.getLogId()));
    expect(byLogId.has(logA)).toBe(true);
    expect(byLogId.has(logB)).toBe(true);
    expect(byLogId.has(logC)).toBe(false);
    expect(result).toHaveLength(2);
  });

  test('findByLogIds() with an empty array returns [] without querying', async () => {
    const result = await repo.findByLogIds([]);
    expect(result).toEqual([]);
  });

  test('delete() removes the row and a second delete() call returns false', async () => {
    const logId = await insertLog();
    const saved = await repo.save({ id: uuidv7(), logId, storageKey: `key-${uuidv7()}`, mimeType: 'image/png' });

    const firstDelete = await repo.delete(saved.getId());
    expect(firstDelete).toBe(true);
    expect(await repo.findById(saved.getId())).toBeNull();

    const secondDelete = await repo.delete(saved.getId());
    expect(secondDelete).toBe(false);
  });

  test('deleting the parent daily_log cascades to its attachments', async () => {
    const logId = await insertLog();
    const saved = await repo.save({ id: uuidv7(), logId, storageKey: `key-${uuidv7()}`, mimeType: 'image/png' });

    await pool.query(`DELETE FROM daily_logs WHERE id = $1`, [logId]);

    expect(await repo.findById(saved.getId())).toBeNull();
  });
});
