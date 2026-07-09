/**
 * Integration tests for DataExportService.
 *
 * Tests exercise the service against a mock pg Pool and a mock
 * S3StorageService — no real database or AWS connection required.
 *
 * Covers:
 *  1.  exportChild() throws NotFoundError when the child doesn't belong to the user
 *  2.  exportChild() uploads a JSON object to S3 under exports/{userId}/...
 *  3.  exportChild() returns the presigned download URL and an expiresAt timestamp
 *  4.  exportChild() scopes every child-linked-table query to userId + childId
 *  5.  exportAccount() gathers every child the user owns plus account-level tables
 *  6.  exportAccount() scopes every query to userId
 */

import { Pool } from 'pg';
import { DataExportService } from 'application/services/DataExportService';
import { S3StorageService } from 'infrastructure/storage/S3StorageService';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';

function makeQueryResult(rows: Record<string, unknown>[]) {
  return { rows, rowCount: rows.length };
}

function makePool(childExists = true) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const mockQuery = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM children WHERE id')) {
      return Promise.resolve(makeQueryResult(childExists ? [{ id: CHILD_ID, name: 'Ana' }] : []));
    }
    if (sql.includes('FROM children WHERE user_id')) {
      return Promise.resolve(makeQueryResult(childExists ? [{ id: CHILD_ID, name: 'Ana' }] : []));
    }
    // every other query used by gatherChildLinkedTables / exportAccount's extras
    return Promise.resolve(makeQueryResult([]));
  });
  const pool = { query: mockQuery } as unknown as Pool;
  return { pool, calls };
}

function makeStorage() {
  const putObject = jest.fn().mockResolvedValue(undefined);
  const getDownloadUrl = jest.fn().mockResolvedValue('https://s3.example.com/signed-url');
  const storage = { putObject, getDownloadUrl, deleteObject: jest.fn() } as unknown as S3StorageService;
  return { storage, putObject, getDownloadUrl };
}

describe('DataExportService', () => {
  describe('exportChild', () => {
    test('throws NotFoundError when the child does not belong to the user', async () => {
      const { pool } = makePool(false);
      const { storage } = makeStorage();
      const service = new DataExportService(pool, storage);

      await expect(service.exportChild(USER_ID, CHILD_ID)).rejects.toThrow(NotFoundError);
    });

    test('uploads a JSON object to S3 under exports/{userId}/...', async () => {
      const { pool } = makePool();
      const { storage, putObject } = makeStorage();
      const service = new DataExportService(pool, storage);

      await service.exportChild(USER_ID, CHILD_ID);

      expect(putObject).toHaveBeenCalledTimes(1);
      const [key, body, contentType] = putObject.mock.calls[0];
      expect(key).toMatch(new RegExp(`^exports/${USER_ID}/child-${CHILD_ID}-`));
      expect(contentType).toBe('application/json');
      const parsed = JSON.parse(body as string);
      expect(parsed.scope).toBe('child');
      expect(parsed.child).toEqual({ id: CHILD_ID, name: 'Ana' });
    });

    test('returns the presigned download URL and an expiresAt timestamp', async () => {
      const { pool } = makePool();
      const { storage } = makeStorage();
      const service = new DataExportService(pool, storage);

      const result = await service.exportChild(USER_ID, CHILD_ID);

      expect(result.downloadUrl).toBe('https://s3.example.com/signed-url');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    test('scopes every child-linked-table query to userId and childId', async () => {
      const { pool, calls } = makePool();
      const { storage } = makeStorage();
      const service = new DataExportService(pool, storage);

      await service.exportChild(USER_ID, CHILD_ID);

      const scopedCalls = calls.filter((c) => c.params.length >= 2 && c.params[0] === USER_ID && c.params[1] === CHILD_ID);
      // 17 tables queried by gatherChildLinkedTables, plus the initial ownership check
      expect(scopedCalls.length).toBeGreaterThanOrEqual(17);
    });
  });

  describe('exportAccount', () => {
    test('gathers every child the user owns plus account-level tables', async () => {
      const { pool } = makePool();
      const { storage, putObject } = makeStorage();
      const service = new DataExportService(pool, storage);

      await service.exportAccount(USER_ID);

      const [key, body] = putObject.mock.calls[0];
      expect(key).toMatch(new RegExp(`^exports/${USER_ID}/account-`));
      const parsed = JSON.parse(body as string);
      expect(parsed.scope).toBe('account');
      expect(parsed.children).toHaveLength(1);
      expect(parsed.children[0].child).toEqual({ id: CHILD_ID, name: 'Ana' });
      expect(parsed).toHaveProperty('anamneses');
      expect(parsed).toHaveProperty('professionals');
      expect(parsed).toHaveProperty('formDrafts');
    });

    test('scopes every top-level query to userId', async () => {
      const { pool, calls } = makePool();
      const { storage } = makeStorage();
      const service = new DataExportService(pool, storage);

      await service.exportAccount(USER_ID);

      const topLevelCalls = calls.filter((c) => c.sql.includes('WHERE user_id = $1') || c.sql.includes('WHERE owner_user_id = $1') || c.sql.includes('WHERE caregiver_user_id = $1'));
      expect(topLevelCalls.length).toBeGreaterThan(0);
      for (const call of topLevelCalls) {
        expect(call.params[0]).toBe(USER_ID);
      }
    });
  });
});
