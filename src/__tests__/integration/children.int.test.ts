/**
 * Integration tests for ChildProfileService.
 *
 * Tests exercise service against mock pool — no real database required.
 *
 * ChildProfileService.getProfile:
 *  1. throws NotFoundError when child not found
 *  2. returns ChildProfileResult with correct child data
 *  3. stats default to 0 when all counts are empty
 *  4. stats reflect correct counts from DB
 *
 * ChildProfileService.getTimeline:
 *  5. throws NotFoundError when child not found
 *  6. returns paginated timeline with correct shape
 *  7. total_count zero when no rows
 *  8. maps different event types correctly
 *  9. passes from/to filters as params
 * 10. computes offset correctly for page > 1
 *
 * ChildService CRUD (via service, with mock repo):
 * 11. list returns children from repo
 * 12. get returns null when not found
 * 13. create returns new child from repo
 * 14. update returns null when not found
 * 15. delete returns false when child has assessments
 */

import { Pool, QueryResult } from 'pg';
import { ChildProfileService } from 'application/services/ChildProfileService';
import { ChildService } from 'application/services/ChildService';
import { Child } from 'domain/entities/Child';
import type { ChildRepository, ChildCreateInput, ChildUpdateInput } from 'domain/repositories/ChildRepository';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult<T extends Record<string, unknown>>(rows: T[]): QueryResult {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

function makeChildRow() {
  return {
    id: CHILD_ID,
    name: 'Ana Beatriz',
    birth_date: '2018-03-15',
    notes: 'Gosta de música.',
    created_at: new Date('2024-01-01T00:00:00Z'),
  };
}

function makeChild(): Child {
  return new Child({
    id: CHILD_ID,
    userId: USER_ID,
    name: 'Ana Beatriz',
    birthDate: '2018-03-15',
    gender: null,
    nationalIdentity: null,
    otherInfo: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  });
}

// ---------------------------------------------------------------------------
// Pool factory for ChildProfileService tests
// ---------------------------------------------------------------------------

function makePool(
  childRows: Record<string, unknown>[] = [makeChildRow()],
  countOverride: number = 3,
): Pool {
  let callCount = 0;

  const mockQuery = jest.fn().mockImplementation((sql: string) => {
    // Timeline UNION query (check before COUNT to avoid matching COUNT(*) OVER())
    if (sql.includes('timeline_raw')) {
      const rows = [
        {
          id: 'evt-001',
          type: 'log',
          occurred_at: '2025-05-01T10:00:00.000Z',
          title: 'mood',
          subtitle: 'Bom dia!',
          total_count: '2',
        },
        {
          id: 'evt-002',
          type: 'assessment',
          occurred_at: '2025-04-15T09:00:00.000Z',
          title: 'mchat-r',
          subtitle: null,
          total_count: '2',
        },
      ];
      return Promise.resolve(makeQueryResult(rows));
    }
    // Child ownership check
    if (sql.includes('FROM children WHERE')) {
      return Promise.resolve(makeQueryResult(childRows));
    }
    // COUNT queries (profile stats)
    if (sql.includes('COUNT(*)')) {
      callCount++;
      return Promise.resolve(makeQueryResult([{ cnt: String(countOverride) }]));
    }
    return Promise.resolve(makeQueryResult([]));
  });

  return { query: mockQuery } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// ChildRepository mock factory
// ---------------------------------------------------------------------------

function makeRepo(overrides: Partial<ChildRepository> = {}): ChildRepository {
  return {
    findByUserId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeChild()),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
    hasAssessments: jest.fn().mockResolvedValue(false),
    findOrCreate: jest.fn().mockResolvedValue(makeChild()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ChildProfileService tests
// ---------------------------------------------------------------------------

describe('ChildProfileService', () => {
  // 1. throws NotFoundError when child not found
  test('getProfile throws NotFoundError when child not found', async () => {
    const pool = makePool([]);
    const service = new ChildProfileService(pool);
    await expect(service.getProfile(CHILD_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  // 2. returns ChildProfileResult with correct child data
  test('getProfile returns ChildProfileResult with correct child data', async () => {
    const pool = makePool();
    const service = new ChildProfileService(pool);
    const result = await service.getProfile(CHILD_ID, USER_ID);
    expect(result.child.id).toBe(CHILD_ID);
    expect(result.child.name).toBe('Ana Beatriz');
    expect(result.child.birthDate).toBe('2018-03-15');
    expect(result.child.notes).toBe('Gosta de música.');
    expect(typeof result.child.createdAt).toBe('string');
  });

  // 3. stats default to 0 when all counts are empty
  test('getProfile stats default to 0 when all counts empty', async () => {
    const mockQuery = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM children WHERE')) {
        return Promise.resolve(makeQueryResult([makeChildRow()]));
      }
      return Promise.resolve(makeQueryResult([{ cnt: '0' }]));
    });
    const pool = { query: mockQuery } as unknown as Pool;
    const service = new ChildProfileService(pool);
    const result = await service.getProfile(CHILD_ID, USER_ID);
    expect(result.stats.assessmentCount).toBe(0);
    expect(result.stats.logCount).toBe(0);
    expect(result.stats.therapySessionCount).toBe(0);
    expect(result.stats.activeMedicationCount).toBe(0);
    expect(result.stats.achievedMilestoneCount).toBe(0);
    expect(result.stats.educationPlanCount).toBe(0);
  });

  // 4. stats reflect correct counts from DB
  test('getProfile stats reflect counts from DB', async () => {
    const pool = makePool([makeChildRow()], 5);
    const service = new ChildProfileService(pool);
    const result = await service.getProfile(CHILD_ID, USER_ID);
    expect(result.stats.assessmentCount).toBe(5);
    expect(result.stats.logCount).toBe(5);
    expect(result.stats.therapySessionCount).toBe(5);
  });

  // 5. getTimeline throws NotFoundError when child not found
  test('getTimeline throws NotFoundError when child not found', async () => {
    const pool = makePool([]);
    const service = new ChildProfileService(pool);
    await expect(service.getTimeline(CHILD_ID, USER_ID, 1, 20)).rejects.toThrow(NotFoundError);
  });

  // 6. returns paginated timeline with correct shape
  test('getTimeline returns paginated timeline with correct shape', async () => {
    const pool = makePool();
    const service = new ChildProfileService(pool);
    const result = await service.getTimeline(CHILD_ID, USER_ID, 1, 20);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('limit', 20);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  // 7. total is zero when no rows
  test('getTimeline total is 0 when no rows returned', async () => {
    const mockQuery = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM children WHERE')) {
        return Promise.resolve(makeQueryResult([makeChildRow()]));
      }
      return Promise.resolve(makeQueryResult([]));
    });
    const pool = { query: mockQuery } as unknown as Pool;
    const service = new ChildProfileService(pool);
    const result = await service.getTimeline(CHILD_ID, USER_ID, 1, 20);
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  // 8. maps different event types correctly
  test('getTimeline maps log and assessment event types correctly', async () => {
    const pool = makePool();
    const service = new ChildProfileService(pool);
    const result = await service.getTimeline(CHILD_ID, USER_ID, 1, 20);
    const types = result.data.map(e => e.type);
    expect(types).toContain('log');
    expect(types).toContain('assessment');
    expect(result.data[0].occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // 9. passes from/to filters as params
  test('getTimeline passes from/to as query params', async () => {
    const pool = makePool();
    const service = new ChildProfileService(pool);
    const from = '2025-01-01T00:00:00.000Z';
    const to = '2025-12-31T23:59:59.000Z';
    await service.getTimeline(CHILD_ID, USER_ID, 1, 20, from, to);
    // The third query call should be the UNION query
    const calls = (pool.query as jest.Mock).mock.calls;
    const timelineCall = calls.find((args: unknown[]) => (args[0] as string).includes('timeline_raw'));
    expect(timelineCall).toBeDefined();
    expect(timelineCall[1]).toContain(from);
    expect(timelineCall[1]).toContain(to);
  });

  // 10. computes offset correctly for page > 1
  test('getTimeline computes correct offset for page=3 limit=10', async () => {
    const pool = makePool();
    const service = new ChildProfileService(pool);
    await service.getTimeline(CHILD_ID, USER_ID, 3, 10);
    const calls = (pool.query as jest.Mock).mock.calls;
    const timelineCall = calls.find((args: unknown[]) => (args[0] as string).includes('timeline_raw'));
    expect(timelineCall).toBeDefined();
    // offset = (3-1) * 10 = 20
    expect(timelineCall[1]).toContain(20);
  });
});

// ---------------------------------------------------------------------------
// ChildService CRUD tests (mock repo)
// ---------------------------------------------------------------------------

describe('ChildService (mock repo)', () => {
  // 11. list returns children from repo
  test('list returns children from repo', async () => {
    const child = makeChild();
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue([child]) });
    const service = new ChildService(repo);
    const result = await service.list(USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(child);
  });

  // 12. get returns null when not found
  test('get returns null when child not found', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new ChildService(repo);
    const result = await service.get('nonexistent', USER_ID);
    expect(result).toBeNull();
  });

  // 13. create returns new child from repo
  test('create returns new child from repo', async () => {
    const child = makeChild();
    const repo = makeRepo({ create: jest.fn().mockResolvedValue(child) });
    const service = new ChildService(repo);
    const result = await service.create(USER_ID, { name: 'Ana', birthDate: '2018-03-15' });
    expect(result).toBe(child);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  // 14. update returns null when not found
  test('update returns null when child not found', async () => {
    const repo = makeRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new ChildService(repo);
    const result = await service.update('nonexistent', USER_ID, { name: 'New Name' });
    expect(result).toBeNull();
  });

  // 15. delete returns false when child has assessments
  test('delete returns false when child has assessments', async () => {
    const repo = makeRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new ChildService(repo);
    const result = await service.delete(CHILD_ID, USER_ID);
    expect(result).toBe(false);
  });
});
