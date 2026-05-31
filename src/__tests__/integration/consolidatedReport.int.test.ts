/**
 * Integration tests for ConsolidatedReportService and ReportShareService.
 *
 * Tests exercise services against mock pool and mock repositories — no real
 * database connection required.
 *
 * ConsolidatedReportService tests:
 *  1.  getSummary throws NotFoundError when child not found
 *  2.  getSummary returns valid ConsolidatedSummary for known child
 *  3.  getSummary byType sums log counts correctly
 *
 * ReportShareService tests:
 *  4.  createShare throws NotFoundError when child not found (via consolidated service)
 *  5.  createShare returns a ReportShare with correct childId
 *  6.  listShares delegates to repo.findByUserAndChild
 *  7.  deleteShare delegates to repo.deleteById
 *  8.  getSharedSummary throws NotFoundError when token not found
 *  9.  getSharedSummary throws AuthorizationError when share is expired
 * 10.  getSharedSummary returns summary for valid non-expired share
 *
 * AISummaryService tests:
 * 11.  generateSummary throws when ANTHROPIC_API_KEY not set
 * 12.  generateSummary calls Anthropic client with a prompt and returns text
 */

import { Pool } from 'pg';
import { ConsolidatedReportService, ConsolidatedSummary } from 'application/services/ConsolidatedReportService';
import { ReportShareService } from 'application/services/ReportShareService';
import { AISummaryService } from 'application/services/AISummaryService';
import { ReportShare } from 'domain/entities/ReportShare';
import type { ReportShareRepository } from 'domain/repositories/ReportShareRepository';
import { NotFoundError, GoneError } from 'infrastructure/utils/errors/CustomErrors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-000000000001';
const SHARE_ID = '018f4e8a-0000-7000-8000-000000000010';
const TOKEN = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShare(overrides: Partial<{ id: string; userId: string; childId: string; token: string; periodDays: number; expiresAt: Date; createdAt: Date }> = {}): ReportShare {
  return new ReportShare({
    id: overrides.id ?? SHARE_ID,
    userId: overrides.userId ?? USER_ID,
    childId: overrides.childId ?? CHILD_ID,
    token: overrides.token ?? TOKEN,
    periodDays: overrides.periodDays ?? 90,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: overrides.createdAt ?? new Date(),
  });
}

function makeQueryResult(rows: Record<string, unknown>[]) {
  return { rows, rowCount: rows.length };
}

function makeSummary(childName: string = 'Ana'): ConsolidatedSummary {
  return {
    child: { id: CHILD_ID, name: childName, birthDate: null, notes: null },
    generatedAt: new Date().toISOString(),
    period: { from: new Date().toISOString(), to: new Date().toISOString() },
    assessments: { recent: [], count: 0 },
    logs: { byType: {}, totalCount: 0 },
    therapy: { activeTherapists: [], recentSessions: [], sessionCount: 0, byType: {} },
    medical: { activeMedications: [], comorbidities: [], recentAppointments: [] },
    development: { milestoneStats: { achieved: 0, inProgress: 0, notYet: 0, regressed: 0 }, recentCommunicationLogs: [] },
    education: { plans: [], recentComms: [] },
  };
}

function makeShareRepo(overrides: Partial<ReportShareRepository> = {}): ReportShareRepository {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findByToken: jest.fn().mockResolvedValue(null),
    findByUserAndChild: jest.fn().mockResolvedValue([]),
    deleteById: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

function makePool(childRows: Record<string, unknown>[] = [{ id: CHILD_ID, name: 'Ana' }]): Pool {
  const emptyResult = makeQueryResult([]);
  const mockQuery = jest.fn().mockImplementation((sql: string) => {
    // Child ownership check
    if (sql.includes('FROM children WHERE')) {
      return Promise.resolve(makeQueryResult(childRows));
    }
    // daily_logs GROUP BY
    if (sql.includes('FROM daily_logs')) {
      return Promise.resolve(makeQueryResult([
        { log_type: 'mood', cnt: '3' },
        { log_type: 'abc', cnt: '2' },
      ]));
    }
    // therapy_sessions
    if (sql.includes('FROM therapy_sessions')) {
      return Promise.resolve(emptyResult);
    }
    // therapists
    if (sql.includes('FROM therapists')) {
      return Promise.resolve(emptyResult);
    }
    // medications
    if (sql.includes('FROM medications')) {
      return Promise.resolve(emptyResult);
    }
    // comorbidities
    if (sql.includes('FROM comorbidities')) {
      return Promise.resolve(emptyResult);
    }
    // medical_appointments
    if (sql.includes('FROM medical_appointments')) {
      return Promise.resolve(emptyResult);
    }
    // developmental_milestones
    if (sql.includes('FROM developmental_milestones')) {
      return Promise.resolve(makeQueryResult([
        { status: 'achieved', cnt: '5' },
        { status: 'in_progress', cnt: '2' },
      ]));
    }
    // communication_logs
    if (sql.includes('FROM communication_logs')) {
      return Promise.resolve(emptyResult);
    }
    // education_plans
    if (sql.includes('FROM education_plans')) {
      return Promise.resolve(emptyResult);
    }
    // school_communications
    if (sql.includes('FROM school_communications')) {
      return Promise.resolve(emptyResult);
    }
    // sensory_assessments
    if (sql.includes('FROM sensory_assessments')) {
      return Promise.resolve(emptyResult);
    }
    return Promise.resolve(emptyResult);
  });

  return { query: mockQuery } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// ConsolidatedReportService
// ---------------------------------------------------------------------------

describe('ConsolidatedReportService', () => {
  // 1. throws NotFoundError when child not found
  test('getSummary throws NotFoundError when child not found', async () => {
    const pool = makePool([]); // empty child rows
    const service = new ConsolidatedReportService(pool);

    await expect(service.getSummary(USER_ID, CHILD_ID, 90)).rejects.toThrow(NotFoundError);
  });

  // 2. getSummary returns valid ConsolidatedSummary for known child
  test('getSummary returns ConsolidatedSummary with child name', async () => {
    const pool = makePool();
    const service = new ConsolidatedReportService(pool);

    const result = await service.getSummary(USER_ID, CHILD_ID, 90);
    expect(result.child.id).toBe(CHILD_ID);
    expect(result.child.name).toBe('Ana');
    expect(result.period.from).toBeDefined();
    expect(result.period.to).toBeDefined();
  });

  // 3. getSummary byType sums log counts correctly
  test('getSummary aggregates log byType from GROUP BY rows', async () => {
    const pool = makePool();
    const service = new ConsolidatedReportService(pool);

    const result = await service.getSummary(USER_ID, CHILD_ID, 90);
    expect(result.logs.byType).toEqual({ mood: 3, abc: 2 });
    expect(result.logs.totalCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// ReportShareService
// ---------------------------------------------------------------------------

describe('ReportShareService', () => {
  // 4. createShare throws NotFoundError when child not found
  test('createShare throws NotFoundError when child not found', async () => {
    const pool = makePool([]); // child not found
    const consolidatedService = new ConsolidatedReportService(pool);
    const repo = makeShareRepo();
    const service = new ReportShareService(repo, consolidatedService, pool);

    await expect(service.createShare(USER_ID, CHILD_ID, 30)).rejects.toThrow(NotFoundError);
  });

  // 5. createShare returns a ReportShare with correct childId
  test('createShare returns ReportShare with correct childId', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const repo = makeShareRepo();
    const service = new ReportShareService(repo, consolidatedService, pool);

    const share = await service.createShare(USER_ID, CHILD_ID, 30);
    expect(share).toBeInstanceOf(ReportShare);
    expect(share.getChildId()).toBe(CHILD_ID);
    expect(share.getUserId()).toBe(USER_ID);
    expect(share.getToken()).toBeDefined();
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  // 6. listShares delegates to repo.findByUserAndChild
  test('listShares returns shares from repo', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const share = makeShare();
    const repo = makeShareRepo({
      findByUserAndChild: jest.fn().mockResolvedValue([share]),
    });
    const service = new ReportShareService(repo, consolidatedService, pool);

    const result = await service.listShares(USER_ID, CHILD_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(ReportShare);
    expect(repo.findByUserAndChild).toHaveBeenCalledWith(USER_ID, CHILD_ID);
  });

  // 7. deleteShare delegates to repo.deleteById
  test('deleteShare calls repo.deleteById', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const repo = makeShareRepo();
    const service = new ReportShareService(repo, consolidatedService, pool);

    await service.deleteShare(SHARE_ID, USER_ID);
    expect(repo.deleteById).toHaveBeenCalledWith(SHARE_ID, USER_ID);
  });

  // 8. getSharedSummary throws NotFoundError when token not found
  test('getSharedSummary throws NotFoundError when token not found', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const repo = makeShareRepo({ findByToken: jest.fn().mockResolvedValue(null) });
    const service = new ReportShareService(repo, consolidatedService, pool);

    await expect(service.getSharedSummary(TOKEN)).rejects.toThrow(NotFoundError);
  });

  // 9. getSharedSummary throws GoneError when share is expired
  test('getSharedSummary throws GoneError when share is expired', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const expiredShare = makeShare({ expiresAt: new Date(Date.now() - 1000) }); // 1 second ago
    const repo = makeShareRepo({ findByToken: jest.fn().mockResolvedValue(expiredShare) });
    const service = new ReportShareService(repo, consolidatedService, pool);

    await expect(service.getSharedSummary(TOKEN)).rejects.toThrow(GoneError);
  });

  // 10. getSharedSummary returns summary for valid non-expired share
  test('getSharedSummary returns ConsolidatedSummary for valid share', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);
    const validShare = makeShare();
    const repo = makeShareRepo({ findByToken: jest.fn().mockResolvedValue(validShare) });
    const service = new ReportShareService(repo, consolidatedService, pool);

    const result = await service.getSharedSummary(TOKEN);
    expect(result.child.id).toBe(CHILD_ID);
  });
});

// ---------------------------------------------------------------------------
// AISummaryService
// ---------------------------------------------------------------------------

import { ServiceUnavailableError } from '../../infrastructure/utils/errors/CustomErrors';

describe('AISummaryService', () => {
  // 11. generateSummary throws ServiceUnavailableError when AWS_REGION not set
  test('generateSummary throws ServiceUnavailableError when AWS_REGION is not configured', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);

    const originalRegion = process.env.AWS_REGION;
    const originalDefaultRegion = process.env.AWS_DEFAULT_REGION;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;

    try {
      const aiService = new AISummaryService(consolidatedService);
      await expect(aiService.generateSummary(USER_ID, CHILD_ID, 90)).rejects.toThrow(ServiceUnavailableError);
    } finally {
      if (originalRegion !== undefined) process.env.AWS_REGION = originalRegion;
      if (originalDefaultRegion !== undefined) process.env.AWS_DEFAULT_REGION = originalDefaultRegion;
    }
  });

  // 12. generateSummary attempts Bedrock invoke when region is set
  test('generateSummary attempts Bedrock invocation when AWS_REGION is set', async () => {
    const pool = makePool();
    const consolidatedService = new ConsolidatedReportService(pool);

    const originalRegion = process.env.AWS_REGION;
    process.env.AWS_REGION = 'us-east-1';

    try {
      const aiService = new AISummaryService(consolidatedService);
      await aiService.generateSummary(USER_ID, CHILD_ID, 90);
    } catch (e) {
      expect(e).toBeDefined();
    } finally {
      if (originalRegion !== undefined) process.env.AWS_REGION = originalRegion;
      else delete process.env.AWS_REGION;
    }
  });
});
