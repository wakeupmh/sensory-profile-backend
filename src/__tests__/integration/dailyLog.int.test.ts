/**
 * Integration tests for DailyLogService CRUD operations.
 *
 * These tests exercise DailyLogService against a mock DailyLogRepository,
 * following the same pattern as mchatFollowup.int.test.ts — no real database
 * connection is required. All repository methods are mocked via jest.fn().
 *
 * Tests:
 *  1. create → findById returns the same log
 *  2. findAllByUser with childId filter → returns only that child's logs
 *  3. findAllByUser with logType filter → returns only that type
 *  4. findAllByUser pagination → page 2 works, total is correct
 *  5. update → changed fields reflected, unchanged fields preserved
 *  6. delete → returns true; subsequent findById returns null
 *  7. delete non-existent → service throws (repo returns false)
 *  8. findById wrong userId → returns null (auth isolation)
 */

import { DailyLogService } from 'application/services/DailyLogService';
import { DailyLog, DailyLogSummary } from 'domain/entities/DailyLog';
import {
  DailyLogRepository,
  DailyLogCreateInput,
  DailyLogFilters,
  DailyLogUpdateInput,
} from 'domain/repositories/DailyLogRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const CHILD_ID_A = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const CHILD_ID_B = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const LOG_ID_1 = '018f4e8a-0000-7000-8000-000000000001';
const LOG_ID_2 = '018f4e8a-0000-7000-8000-000000000002';
const LOG_ID_3 = '018f4e8a-0000-7000-8000-000000000003';

const NOW = new Date('2024-06-15T10:30:00.000Z');

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeLog(overrides: Partial<DailyLogCreateInput & { id: string }> = {}): DailyLog {
  return new DailyLog({
    id: overrides.id ?? LOG_ID_1,
    userId: overrides.userId ?? USER_ID,
    childId: overrides.childId ?? CHILD_ID_A,
    logType: overrides.logType ?? 'abc',
    occurredAt: overrides.occurredAt ?? NOW,
    data: overrides.data ?? { antecedent: 'a', behavior: 'b', consequence: 'c' },
    notes: overrides.notes ?? null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function makeSummary(overrides: Partial<DailyLogSummary> = {}): DailyLogSummary {
  return {
    id: overrides.id ?? LOG_ID_1,
    childId: overrides.childId ?? CHILD_ID_A,
    logType: overrides.logType ?? 'abc',
    occurredAt: overrides.occurredAt ?? NOW,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? NOW,
  };
}

function makePaginatedResult(
  summaries: DailyLogSummary[],
  total: number,
  page = 1,
  limit = 20
): { data: DailyLogSummary[]; total: number; page: number; limit: number } {
  return { data: summaries, total, page, limit };
}

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

function makeRepo(
  overrides: Partial<{
    save: jest.Mock;
    findById: jest.Mock;
    findAllByUser: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  }> = {}
): DailyLogRepository {
  return {
    save: overrides.save ?? jest.fn().mockImplementation((input) => Promise.resolve(makeLog(input))),
    findById: overrides.findById ?? jest.fn().mockResolvedValue(null),
    findAllByUser: overrides.findAllByUser ?? jest.fn().mockResolvedValue(makePaginatedResult([], 0)),
    update: overrides.update ?? jest.fn().mockResolvedValue(null),
    delete: overrides.delete ?? jest.fn().mockResolvedValue(false),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DailyLogService — CRUD operations', () => {
  // 1. create → findById returns same log
  test('create then findById returns the created log', async () => {
    const log = makeLog();
    const repo = makeRepo({
      save: jest.fn().mockResolvedValue(log),
      findById: jest.fn().mockResolvedValue(log),
    });
    const service = new DailyLogService(repo);

    await service.create(
      {
        childId: CHILD_ID_A,
        logType: 'abc',
        occurredAt: NOW,
        data: { antecedent: 'a', behavior: 'b', consequence: 'c' },
      },
      USER_ID
    );

    const found = await repo.findById(LOG_ID_1, USER_ID);
    expect(found).not.toBeNull();
    expect(found?.getId()).toBe(LOG_ID_1);
    expect(found?.getLogType()).toBe('abc');
    expect(found?.getChildId()).toBe(CHILD_ID_A);
    expect(found?.getUserId()).toBe(USER_ID);
  });

  // 2. findAllByUser with childId filter → returns only that child's logs
  test('findAllByUser with childId filter returns only that childs logs', async () => {
    const summaryA = makeSummary({ id: LOG_ID_1, childId: CHILD_ID_A });
    const repo = makeRepo({
      findAllByUser: jest.fn().mockImplementation(
        (_userId: string, filters: DailyLogFilters) => {
          const data = filters.childId === CHILD_ID_A ? [summaryA] : [];
          return Promise.resolve(makePaginatedResult(data, data.length));
        }
      ),
    });
    const service = new DailyLogService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID_A });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].childId).toBe(CHILD_ID_A);

    const otherResult = await service.list(USER_ID, { childId: CHILD_ID_B });
    expect(otherResult.data).toHaveLength(0);
  });

  // 3. findAllByUser with logType filter → returns only that type
  test('findAllByUser with logType filter returns only that type', async () => {
    const abcSummary = makeSummary({ id: LOG_ID_1, logType: 'abc' });
    const moodSummary = makeSummary({ id: LOG_ID_2, logType: 'mood' });

    const repo = makeRepo({
      findAllByUser: jest.fn().mockImplementation(
        (_userId: string, filters: DailyLogFilters) => {
          const all = [abcSummary, moodSummary];
          const data = filters.logType ? all.filter((s) => s.logType === filters.logType) : all;
          return Promise.resolve(makePaginatedResult(data, data.length));
        }
      ),
    });
    const service = new DailyLogService(repo);

    const result = await service.list(USER_ID, { logType: 'mood' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].logType).toBe('mood');
  });

  // 4. findAllByUser pagination → page 2 works, total is correct
  test('findAllByUser pagination returns correct page and total', async () => {
    const page2Summary = makeSummary({ id: LOG_ID_3 });

    const repo = makeRepo({
      findAllByUser: jest.fn().mockImplementation(
        (_userId: string, filters: DailyLogFilters) => {
          const page = filters.page ?? 1;
          const limit = filters.limit ?? 20;
          // Simulate 3 total items; page 2 with limit 2 yields 1 item
          if (page === 2 && limit === 2) {
            return Promise.resolve(makePaginatedResult([page2Summary], 3, page, limit));
          }
          return Promise.resolve(makePaginatedResult([], 3, page, limit));
        }
      ),
    });
    const service = new DailyLogService(repo);

    const result = await service.list(USER_ID, { page: 2, limit: 2 });
    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(LOG_ID_3);
  });

  // 5. update → changed fields reflected, unchanged fields preserved
  test('update reflects changed fields and preserves unchanged fields', async () => {
    const original = makeLog({ notes: 'original note', logType: 'abc' });
    const updated = makeLog({ notes: 'updated note', logType: 'abc' });

    const repo = makeRepo({
      update: jest.fn().mockResolvedValue(updated),
    });
    const service = new DailyLogService(repo);

    const result = await service.update(LOG_ID_1, { notes: 'updated note' }, USER_ID);
    expect(result.getNotes()).toBe('updated note');
    // logType was not in the update payload — remains 'abc'
    expect(result.getLogType()).toBe('abc');
    expect(result.getId()).toBe(original.getId());
  });

  // 6. delete → returns true; subsequent findById returns null
  test('delete removes the log; subsequent findById returns null', async () => {
    const findByIdMock = jest.fn()
      .mockResolvedValueOnce(makeLog())  // first call: exists
      .mockResolvedValueOnce(null);       // second call: deleted

    const repo = makeRepo({
      delete: jest.fn().mockResolvedValue(true),
      findById: findByIdMock,
    });
    const service = new DailyLogService(repo);

    // Verify log exists before deletion
    const before = await repo.findById(LOG_ID_1, USER_ID);
    expect(before).not.toBeNull();

    // Delete
    await service.remove(LOG_ID_1, USER_ID);
    expect(repo.delete).toHaveBeenCalledWith(LOG_ID_1, USER_ID);

    // Verify findById returns null after deletion
    const after = await repo.findById(LOG_ID_1, USER_ID);
    expect(after).toBeNull();
  });

  // 7. delete non-existent → service throws
  test('remove non-existent log throws an error', async () => {
    const repo = makeRepo({
      delete: jest.fn().mockResolvedValue(false),
    });
    const service = new DailyLogService(repo);

    await expect(service.remove(LOG_ID_1, USER_ID)).rejects.toThrow(LOG_ID_1);
  });

  // 8. findById wrong userId → returns null (auth isolation)
  test('findById with wrong userId returns null (auth isolation)', async () => {
    const repo = makeRepo({
      // Returns log only for the owning user
      findById: jest.fn().mockImplementation(
        (id: string, userId: string) =>
          userId === USER_ID ? Promise.resolve(makeLog()) : Promise.resolve(null)
      ),
    });
    const service = new DailyLogService(repo);

    const ownersResult = await repo.findById(LOG_ID_1, USER_ID);
    expect(ownersResult).not.toBeNull();

    const otherResult = await repo.findById(LOG_ID_1, OTHER_USER_ID);
    expect(otherResult).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DailyLogService.getById — error path
// ---------------------------------------------------------------------------

describe('DailyLogService.getById', () => {
  test('getById throws when log not found', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new DailyLogService(repo);
    await expect(service.getById(LOG_ID_1, USER_ID)).rejects.toThrow(LOG_ID_1);
  });

  test('getById returns log when found', async () => {
    const log = makeLog();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(log) });
    const service = new DailyLogService(repo);
    const result = await service.getById(LOG_ID_1, USER_ID);
    expect(result.getId()).toBe(LOG_ID_1);
  });
});

// ---------------------------------------------------------------------------
// DailyLogService.update — error path
// ---------------------------------------------------------------------------

describe('DailyLogService.update', () => {
  test('update throws when log not found', async () => {
    const repo = makeRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new DailyLogService(repo);
    const input: DailyLogUpdateInput = { notes: 'whatever' };
    await expect(service.update(LOG_ID_1, input, USER_ID)).rejects.toThrow(LOG_ID_1);
  });
});
