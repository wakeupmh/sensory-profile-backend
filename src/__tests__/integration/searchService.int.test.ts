/**
 * Integration tests for SearchService.
 *
 * Tests exercise the service against a mock pg Pool — no real database
 * connection required.
 *
 * Covers:
 *  1.  search() scopes every query to the given userId
 *  2.  search() returns children, logs, and documents shaped per their result types
 *  3.  search() sends a %pattern% built from the query to every underlying query
 *  4.  search() escapes %, _, and \ in the query before building the LIKE pattern
 *  5.  a notes value longer than the snippet limit is truncated with an ellipsis
 *  6.  a notes value at or under the snippet limit is returned unmodified
 *  7.  search() limits each category independently — an empty logs result doesn't affect children/documents
 */

import { Pool } from 'pg';
import { SearchService } from 'application/services/SearchService';

const USER_ID = 'user-001';

function makeQueryResult(rows: Record<string, unknown>[]) {
  return { rows, rowCount: rows.length };
}

interface MockPoolConfig {
  children?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
}

function makePool(config: MockPoolConfig = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('FROM children')) return Promise.resolve(makeQueryResult(config.children ?? []));
    if (sql.includes('FROM daily_logs')) return Promise.resolve(makeQueryResult(config.logs ?? []));
    if (sql.includes('FROM documents')) return Promise.resolve(makeQueryResult(config.documents ?? []));
    throw new Error(`Unexpected query: ${sql}`);
  });
  const pool = { query: mockQuery } as unknown as Pool;
  return { pool, calls };
}

describe('SearchService', () => {
  test('scopes every underlying query to the given userId', async () => {
    const { pool, calls } = makePool();
    const service = new SearchService(pool);

    await service.search(USER_ID, 'febre');

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.params[0]).toBe(USER_ID);
    }
  });

  test('returns children, logs, and documents shaped per their result types', async () => {
    const occurredAt = new Date('2026-06-01T12:00:00.000Z');
    const createdAt = new Date('2026-05-15T09:00:00.000Z');
    const { pool } = makePool({
      children: [{ id: 'child-1', name: 'Ana Febre' }],
      logs: [{ id: 'log-1', child_id: 'child-1', child_name: 'Ana', log_type: 'mood', occurred_at: occurredAt, notes: 'Febre alta à noite' }],
      documents: [{ id: 'doc-1', child_id: 'child-1', child_name: 'Ana', title: 'Exame de febre', created_at: createdAt }],
    });
    const service = new SearchService(pool);

    const result = await service.search(USER_ID, 'febre');

    expect(result.children).toEqual([{ id: 'child-1', name: 'Ana Febre' }]);
    expect(result.logs).toEqual([
      { id: 'log-1', childId: 'child-1', childName: 'Ana', logType: 'mood', occurredAt: occurredAt.toISOString(), notesSnippet: 'Febre alta à noite' },
    ]);
    expect(result.documents).toEqual([
      { id: 'doc-1', childId: 'child-1', childName: 'Ana', title: 'Exame de febre', createdAt: createdAt.toISOString() },
    ]);
  });

  test('sends a %pattern% built from the query to every underlying query', async () => {
    const { pool, calls } = makePool();
    const service = new SearchService(pool);

    await service.search(USER_ID, 'febre');

    for (const call of calls) {
      expect(call.params[1]).toBe('%febre%');
    }
  });

  test('escapes %, _, and \\ in the query before building the LIKE pattern', async () => {
    const { pool, calls } = makePool();
    const service = new SearchService(pool);

    await service.search(USER_ID, '50%_a\\b');

    for (const call of calls) {
      expect(call.params[1]).toBe('%50\\%\\_a\\\\b%');
    }
  });

  test('truncates a notes value longer than the snippet limit with an ellipsis', async () => {
    const longNotes = 'x'.repeat(200);
    const { pool } = makePool({
      logs: [{ id: 'log-1', child_id: 'child-1', child_name: 'Ana', log_type: 'mood', occurred_at: new Date(), notes: longNotes }],
    });
    const service = new SearchService(pool);

    const result = await service.search(USER_ID, 'x');

    expect(result.logs[0].notesSnippet.length).toBeLessThan(longNotes.length);
    expect(result.logs[0].notesSnippet.endsWith('…')).toBe(true);
  });

  test('returns a notes value at or under the snippet limit unmodified', async () => {
    const shortNotes = 'Febre alta à noite';
    const { pool } = makePool({
      logs: [{ id: 'log-1', child_id: 'child-1', child_name: 'Ana', log_type: 'mood', occurred_at: new Date(), notes: shortNotes }],
    });
    const service = new SearchService(pool);

    const result = await service.search(USER_ID, 'febre');

    expect(result.logs[0].notesSnippet).toBe(shortNotes);
  });

  test('an empty logs result does not affect children/documents results', async () => {
    const { pool } = makePool({
      children: [{ id: 'child-1', name: 'Ana' }],
      logs: [],
      documents: [{ id: 'doc-1', child_id: 'child-1', child_name: 'Ana', title: 'Ana laudo', created_at: new Date() }],
    });
    const service = new SearchService(pool);

    const result = await service.search(USER_ID, 'ana');

    expect(result.children).toHaveLength(1);
    expect(result.logs).toHaveLength(0);
    expect(result.documents).toHaveLength(1);
  });
});
