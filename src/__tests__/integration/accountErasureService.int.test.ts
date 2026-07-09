/**
 * Integration tests for AccountErasureService.
 *
 * Tests exercise the service against a mock pg Pool and a mock
 * S3StorageService — no real database or AWS connection required.
 *
 * Covers:
 *  1.  collectChildStorageKeys() returns document storage keys for the child
 *  2.  collectChildStorageKeys() returns log-attachment storage keys for the child
 *  3.  collectChildStorageKeys() scopes both queries to userId and childId
 *  4.  deleteStorageKeys() calls storage.deleteObject for every key and returns the fulfilled count
 *  5.  deleteStorageKeys() doesn't let one failed delete block the others (Promise.allSettled)
 *  6.  eraseAccount() deletes sensory_assessments before children (unblocks the normal delete guard)
 *  7.  eraseAccount() scopes every DELETE to the given userId
 *  8.  eraseAccount() collects and deletes S3 keys across every child the user owns
 *  9.  eraseAccount() returns childrenDeleted from the DELETE FROM children rowCount
 */

import { Pool } from 'pg';
import { AccountErasureService } from 'application/services/AccountErasureService';
import { S3StorageService } from 'infrastructure/storage/S3StorageService';

const USER_ID = 'user-001';
const CHILD_A = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const CHILD_B = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';

function makeQueryResult(rows: Record<string, unknown>[], rowCount?: number) {
  return { rows, rowCount: rowCount ?? rows.length };
}

interface MockPoolConfig {
  children?: Record<string, unknown>[];
  documentsByChild?: Record<string, Record<string, unknown>[]>;
  attachmentsByChild?: Record<string, Record<string, unknown>[]>;
  childrenDeleteRowCount?: number;
}

function makePool(config: MockPoolConfig = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT id FROM children')) return Promise.resolve(makeQueryResult(config.children ?? []));
    if (sql.includes('FROM documents')) {
      const childId = params[1] as string;
      return Promise.resolve(makeQueryResult(config.documentsByChild?.[childId] ?? []));
    }
    if (sql.includes('FROM log_attachments')) {
      const childId = params[1] as string;
      return Promise.resolve(makeQueryResult(config.attachmentsByChild?.[childId] ?? []));
    }
    if (sql.includes('DELETE FROM sensory_assessments')) return Promise.resolve(makeQueryResult([]));
    if (sql.includes('DELETE FROM children')) return Promise.resolve(makeQueryResult([], config.childrenDeleteRowCount ?? 0));
    if (sql.startsWith('DELETE FROM')) return Promise.resolve(makeQueryResult([]));
    throw new Error(`Unexpected query: ${sql}`);
  });
  const pool = { query: mockQuery } as unknown as Pool;
  return { pool, calls };
}

function makeStorage(deleteBehavior?: (key: string) => Promise<void>) {
  const deleteObject = jest.fn().mockImplementation(deleteBehavior ?? (() => Promise.resolve()));
  const storage = { deleteObject, putObject: jest.fn(), getDownloadUrl: jest.fn() } as unknown as S3StorageService;
  return { storage, deleteObject };
}

describe('AccountErasureService', () => {
  describe('collectChildStorageKeys', () => {
    test('returns document storage keys for the child', async () => {
      const { pool } = makePool({
        documentsByChild: { [CHILD_A]: [{ storage_key: 'documents/a.pdf' }, { storage_key: 'documents/b.pdf' }] },
      });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      const keys = await service.collectChildStorageKeys(USER_ID, CHILD_A);

      expect(keys).toEqual(['documents/a.pdf', 'documents/b.pdf']);
    });

    test('returns log-attachment storage keys for the child', async () => {
      const { pool } = makePool({
        attachmentsByChild: { [CHILD_A]: [{ storage_key: 'log-attachments/x.jpg' }] },
      });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      const keys = await service.collectChildStorageKeys(USER_ID, CHILD_A);

      expect(keys).toEqual(['log-attachments/x.jpg']);
    });

    test('scopes both queries to userId and childId', async () => {
      const { pool, calls } = makePool();
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.collectChildStorageKeys(USER_ID, CHILD_A);

      const documentsCall = calls.find((c) => c.sql.includes('FROM documents'));
      const attachmentsCall = calls.find((c) => c.sql.includes('FROM log_attachments'));
      expect(documentsCall?.params).toEqual([USER_ID, CHILD_A]);
      expect(attachmentsCall?.params).toEqual([USER_ID, CHILD_A]);
    });
  });

  describe('deleteStorageKeys', () => {
    test('calls storage.deleteObject for every key and returns the fulfilled count', async () => {
      const { pool } = makePool();
      const { storage, deleteObject } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      const count = await service.deleteStorageKeys(['a', 'b', 'c']);

      expect(deleteObject).toHaveBeenCalledTimes(3);
      expect(count).toBe(3);
    });

    test('one failed delete does not block the others', async () => {
      const { pool } = makePool();
      const { storage } = makeStorage((key) => (key === 'bad' ? Promise.reject(new Error('S3 error')) : Promise.resolve()));
      const service = new AccountErasureService(pool, storage);

      const count = await service.deleteStorageKeys(['good-1', 'bad', 'good-2']);

      expect(count).toBe(2);
    });
  });

  describe('eraseAccount', () => {
    test('deletes sensory_assessments before children, unblocking the normal delete guard', async () => {
      const { pool, calls } = makePool({ children: [{ id: CHILD_A }] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const assessmentsIndex = calls.findIndex((c) => c.sql.includes('DELETE FROM sensory_assessments'));
      const childrenIndex = calls.findIndex((c) => c.sql.includes('DELETE FROM children'));
      expect(assessmentsIndex).toBeGreaterThanOrEqual(0);
      expect(childrenIndex).toBeGreaterThan(assessmentsIndex);
    });

    test('scopes every DELETE to the given userId', async () => {
      const { pool, calls } = makePool({ children: [{ id: CHILD_A }] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const deleteCalls = calls.filter((c) => c.sql.trim().startsWith('DELETE FROM'));
      expect(deleteCalls.length).toBeGreaterThan(0);
      for (const call of deleteCalls) {
        expect(call.params).toContain(USER_ID);
      }
    });

    test('collects and deletes S3 keys across every child the user owns', async () => {
      const { pool } = makePool({
        children: [{ id: CHILD_A }, { id: CHILD_B }],
        documentsByChild: {
          [CHILD_A]: [{ storage_key: 'documents/a.pdf' }],
          [CHILD_B]: [{ storage_key: 'documents/b.pdf' }],
        },
      });
      const { storage, deleteObject } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      const result = await service.eraseAccount(USER_ID);

      expect(deleteObject).toHaveBeenCalledWith('documents/a.pdf');
      expect(deleteObject).toHaveBeenCalledWith('documents/b.pdf');
      expect(result.storageObjectsDeleted).toBe(2);
    });

    test('returns childrenDeleted from the DELETE FROM children rowCount', async () => {
      const { pool } = makePool({ children: [{ id: CHILD_A }, { id: CHILD_B }], childrenDeleteRowCount: 2 });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      const result = await service.eraseAccount(USER_ID);

      expect(result.childrenDeleted).toBe(2);
    });
  });
});
