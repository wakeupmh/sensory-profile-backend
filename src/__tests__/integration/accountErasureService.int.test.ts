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
 * 10.  eraseAccount() erases the user-scoped tables no cascade reaches
 *      (therapists/examiners/caregivers/push_subscriptions)
 * 11.  eraseAccount() nulls accepted_user_id on another account's professional row
 * 12.  eraseAccount() nulls author_user_id on every AUTHOR_ATTRIBUTED_TABLES table
 * 13.  eraseAccount() nulls member_user_id and revokes care_team_members rows when the table exists
 * 14.  eraseAccount() skips the care_team_members pass when the table does not exist yet
 * 15.  eraseAccount() wraps the wipe in one transaction and releases the client
 * 16.  eraseAccount() rolls back and leaves S3 untouched when a delete fails
 *
 * Real-database coverage for the author-neutralisation pass itself (a row
 * that survives with author_user_id actually cleared) lives in
 * accountErasureAuthorship.int.test.ts — this file stays mock-only, like the
 * rest of AccountErasureService's suite.
 */

import { Pool } from 'pg';
import { AccountErasureService, AUTHOR_ATTRIBUTED_TABLES } from 'application/services/AccountErasureService';
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
  dailyReportsByChild?: Record<string, Record<string, unknown>[]>;
  voiceNotes?: Record<string, unknown>[];
  childrenDeleteRowCount?: number;
  /** Faz qualquer DELETE falhar, para exercitar o ROLLBACK. */
  failOnDelete?: boolean;
  /**
   * Simula se `care_team_members` já existe no banco (migration 035 é do
   * a migration 035 e pode não ter rodado ainda). `undefined`/`false` reproduz um
   * banco sem a tabela — o caminho mais comum enquanto o care team está em
   * construção em paralelo.
   */
  careTeamTableExists?: boolean;
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
    if (sql.includes('FROM voice_notes')) return Promise.resolve(makeQueryResult(config.voiceNotes ?? []));
    if (sql.includes('FROM daily_reports')) {
      const childId = params[1] as string;
      return Promise.resolve(makeQueryResult(config.dailyReportsByChild?.[childId] ?? []));
    }
    if (sql.includes('information_schema.tables')) {
      return Promise.resolve(makeQueryResult(config.careTeamTableExists ? [{ '?column?': 1 }] : []));
    }
    if (sql.startsWith('DELETE FROM')) {
      if (config.failOnDelete) return Promise.reject(new Error('constraint violation'));
      if (sql.includes('DELETE FROM children')) return Promise.resolve(makeQueryResult([], config.childrenDeleteRowCount ?? 0));
      return Promise.resolve(makeQueryResult([]));
    }
    if (sql.startsWith('UPDATE ')) return Promise.resolve(makeQueryResult([]));
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return Promise.resolve(makeQueryResult([]));
    throw new Error(`Unexpected query: ${sql}`);
  });
  // eraseAccount runs its deletes on a single checked-out client so the whole
  // wipe is one transaction. The client shares `mockQuery`, so `calls` still
  // records every statement regardless of which handle issued it.
  const release = jest.fn();
  const pool = {
    query: mockQuery,
    connect: jest.fn().mockResolvedValue({ query: mockQuery, release }),
  } as unknown as Pool;
  return { pool, calls, release };
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

    test('collects abandoned dictation audio, which hangs off the account and no cascade reaches', async () => {
      const { pool } = makePool({
        voiceNotes: [
          { audio_storage_key: 'voice-notes/u/v1/audio.webm', transcript_key: 'voice-notes/u/v1/t.json' },
          // Ditado já transcrito: o áudio foi descartado na hora, nada a apagar.
          { audio_storage_key: null, transcript_key: null },
        ],
      });
      const { storage, deleteObject } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const deleted = deleteObject.mock.calls.map((c) => c[0]);
      expect(deleted).toContain('voice-notes/u/v1/audio.webm');
      expect(deleted).toContain('voice-notes/u/v1/t.json');
      expect(deleted).not.toContain(null);
    });

    test('collects the spoken daily report audio and transcript, which cascade away with the child', async () => {
      const { pool } = makePool({
        children: [{ id: 'child-1' }],
        dailyReportsByChild: {
          'child-1': [
            { audio_storage_key: 'daily-reports/u/r1/audio.webm', transcript_key: 'daily-reports/u/r1/t.json' },
            // Um relato abandonado antes do upload: sem áudio, sem transcrição.
            { audio_storage_key: null, transcript_key: null },
          ],
        },
      });
      const { storage, deleteObject } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const deleted = deleteObject.mock.calls.map((c) => c[0]);
      expect(deleted).toContain('daily-reports/u/r1/audio.webm');
      expect(deleted).toContain('daily-reports/u/r1/t.json');
      // A linha sem áudio não pode virar uma chamada de delete com `null`.
      expect(deleted).not.toContain(null);
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

    test('erases the user-scoped tables that no cascade reaches', async () => {
      const { pool, calls } = makePool({ children: [{ id: CHILD_A }] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      // These have a user_id but no child_id, so deleting the children does
      // not touch them — they hold contact details of real people and push
      // endpoints, and were silently surviving erasure before.
      const sql = calls.map((c) => c.sql).join('\n');
      for (const table of ['therapists', 'examiners', 'caregivers', 'push_subscriptions']) {
        expect(sql).toContain(`DELETE FROM ${table} WHERE user_id = $1`);
      }
    });

    test('stops pointing another account\'s professional row at the erased user', async () => {
      const { pool, calls } = makePool({ children: [] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const update = calls.find((c) => c.sql.startsWith('UPDATE professionals'));
      expect(update?.sql).toContain('SET accepted_user_id = NULL');
      expect(update?.params).toEqual([USER_ID]);
    });

    test('nulls author_user_id on every AUTHOR_ATTRIBUTED_TABLES table, scoped to the erased user', async () => {
      const { pool, calls } = makePool({ children: [] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      // Este é o buraco de LGPD que o care team abre: um profissional que
      // escreveu no prontuário de OUTRAS famílias não é dono de nenhuma
      // dessas linhas, então nem o DELETE nem o cascade de children as
      // alcançam. Sem este passo, o `sub` de quem pediu a eliminação ficava
      // gravado para sempre no dado de terceiros.
      for (const table of AUTHOR_ATTRIBUTED_TABLES) {
        const update = calls.find((c) => c.sql.startsWith(`UPDATE ${table}`) && c.sql.includes('author_user_id'));
        expect(update?.sql).toContain('SET author_user_id = NULL');
        expect(update?.sql).toContain('WHERE author_user_id = $1');
        expect(update?.params).toEqual([USER_ID]);
      }
    });

    test('nulls member_user_id and revokes care_team_members rows when the table exists', async () => {
      const { pool, calls } = makePool({ children: [], careTeamTableExists: true });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const update = calls.find((c) => c.sql.startsWith('UPDATE care_team_members'));
      expect(update?.sql).toContain('member_user_id = NULL');
      expect(update?.sql).toContain('revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)');
      expect(update?.sql).toContain('WHERE member_user_id = $1');
      expect(update?.params).toEqual([USER_ID]);
    });

    test('skips the care_team_members pass when the table does not exist yet', async () => {
      // a migration 035 pode não ter rodado neste banco ainda —
      // a checagem via information_schema tem que tolerar isso sem quebrar
      // o resto da eliminação.
      const { pool, calls } = makePool({ children: [], careTeamTableExists: false });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await expect(service.eraseAccount(USER_ID)).resolves.toBeDefined();

      const update = calls.find((c) => c.sql.startsWith('UPDATE care_team_members'));
      expect(update).toBeUndefined();
    });

    test('runs the whole wipe in one transaction and releases the client', async () => {
      const { pool, calls, release } = makePool({ children: [{ id: CHILD_A }] });
      const { storage } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await service.eraseAccount(USER_ID);

      const statements = calls.map((c) => c.sql);
      expect(statements).toContain('BEGIN');
      expect(statements).toContain('COMMIT');
      expect(statements.indexOf('BEGIN')).toBeLessThan(statements.findIndex((s) => s.includes('DELETE FROM children')));
      expect(release).toHaveBeenCalled();
    });

    test('rolls back and rethrows if a delete fails, leaving S3 untouched', async () => {
      const { pool, calls, release } = makePool({
        children: [{ id: CHILD_A }],
        documentsByChild: { [CHILD_A]: [{ storage_key: 'documents/a.pdf' }] },
        failOnDelete: true,
      });
      const { storage, deleteObject } = makeStorage();
      const service = new AccountErasureService(pool, storage);

      await expect(service.eraseAccount(USER_ID)).rejects.toThrow('constraint violation');

      expect(calls.map((c) => c.sql)).toContain('ROLLBACK');
      expect(calls.map((c) => c.sql)).not.toContain('COMMIT');
      expect(release).toHaveBeenCalled();
      // The rows survived, so the files must too — otherwise the account is
      // intact but its documents are gone.
      expect(deleteObject).not.toHaveBeenCalled();
    });
  });
});
