/**
 * Real-Postgres integration test for UpcomingReminderService's newly added
 * document-expiry derivation. No test file previously existed for this
 * service — the derived SQL queries had never run against a real database.
 * This covers only the document_expiring case (the one added for the
 * document-expiry feature); the five pre-existing derived types are a
 * separate, pre-existing test gap out of scope here.
 *
 * Covers:
 *  1. a document expiring within the horizon is surfaced as a
 *     document_expiring item with source 'derived' and resourceType 'document'
 *  2. a document expiring beyond the horizon is not included
 *  3. a document with no expiresAt is never included
 *  4. childId filter scopes the result to that child's documents only
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { UpcomingReminderService } from 'application/services/UpcomingReminderService';
import type { ReminderRepository } from 'domain/repositories/ReminderRepository';

const USER_ID = `test-user-${uuidv7()}`;
const CHILD_A = uuidv7();
const CHILD_B = uuidv7();

function emptyReminderRepo(): ReminderRepository {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

async function insertDocument(childId: string, title: string, expiresAt: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO documents (id, user_id, child_id, title, storage_key, mime_type, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'application/pdf', $6)`,
    [uuidv7(), USER_ID, childId, title, `documents/${USER_ID}/${childId}/${uuidv7()}`, expiresAt],
  );
}

function daysFromNowDateString(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  await pool.query(`INSERT INTO children (id, name, user_id) VALUES ($1, 'Child A', $2)`, [CHILD_A, USER_ID]);
  await pool.query(`INSERT INTO children (id, name, user_id) VALUES ($1, 'Child B', $2)`, [CHILD_B, USER_ID]);

  await insertDocument(CHILD_A, 'Laudo expirando em breve', daysFromNowDateString(5));
  await insertDocument(CHILD_A, 'Laudo expirando longe', daysFromNowDateString(60));
  await insertDocument(CHILD_A, 'Laudo sem validade', null);
  await insertDocument(CHILD_B, 'Autorização da criança B', daysFromNowDateString(5));
});

afterAll(async () => {
  await pool.query(`DELETE FROM documents WHERE user_id = $1`, [USER_ID]);
  await pool.query(`DELETE FROM children WHERE user_id = $1`, [USER_ID]);
  await pool.end();
});

describe('UpcomingReminderService — document_expiring derivation (real Postgres)', () => {
  test('a document expiring within the horizon is surfaced as document_expiring', async () => {
    const service = new UpcomingReminderService(pool, emptyReminderRepo());
    const items = await service.getUpcoming(USER_ID, CHILD_A, 14);

    const docItems = items.filter((i) => i.type === 'document_expiring');
    expect(docItems).toHaveLength(1);
    expect(docItems[0]).toMatchObject({
      source: 'derived',
      type: 'document_expiring',
      childId: CHILD_A,
      resourceType: 'document',
    });
    expect(docItems[0].title).toContain('Laudo expirando em breve');
  });

  test('a document expiring beyond the horizon is not included', async () => {
    const service = new UpcomingReminderService(pool, emptyReminderRepo());
    const items = await service.getUpcoming(USER_ID, CHILD_A, 14);

    const titles = items.filter((i) => i.type === 'document_expiring').map((i) => i.title);
    expect(titles.join(' ')).not.toContain('Laudo expirando longe');
  });

  test('a document with no expiresAt is never included', async () => {
    const service = new UpcomingReminderService(pool, emptyReminderRepo());
    const items = await service.getUpcoming(USER_ID, CHILD_A, 365);

    const titles = items.filter((i) => i.type === 'document_expiring').map((i) => i.title);
    expect(titles.join(' ')).not.toContain('Laudo sem validade');
  });

  test('childId filter scopes document_expiring to that child only', async () => {
    const service = new UpcomingReminderService(pool, emptyReminderRepo());
    const items = await service.getUpcoming(USER_ID, CHILD_A, 14);

    const docItems = items.filter((i) => i.type === 'document_expiring');
    expect(docItems.every((i) => i.childId === CHILD_A)).toBe(true);
  });

  test('omitting childId returns document_expiring items across all children', async () => {
    const service = new UpcomingReminderService(pool, emptyReminderRepo());
    const items = await service.getUpcoming(USER_ID, undefined, 14);

    const docItems = items.filter((i) => i.type === 'document_expiring');
    const childIds = new Set(docItems.map((i) => i.childId));
    expect(childIds.has(CHILD_A)).toBe(true);
    expect(childIds.has(CHILD_B)).toBe(true);
  });
});
