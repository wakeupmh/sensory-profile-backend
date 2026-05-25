/**
 * Integration tests for DevelopmentalMilestoneService and CommunicationLogService.
 *
 * Tests exercise services against mock repositories — no real database
 * connection required. All repository methods are mocked via jest.fn().
 *
 * DevelopmentalMilestoneService tests:
 *  1.  create returns DevelopmentalMilestone instance, calls repo.save once
 *  2.  list with childId filter returns only that child's milestones
 *  3.  list with category filter returns only that category's milestones
 *  4.  list with status filter returns only milestones with that status
 *  5.  getById returns milestone when found
 *  6.  getById throws an error containing MILESTONE_ID when not found
 *  7.  update non-existent milestone throws error containing MILESTONE_ID
 *  8.  remove non-existent milestone throws error
 *
 * CommunicationLogService tests:
 *  9.  create returns CommunicationLog instance, calls repo.save once
 * 10.  list with childId filter returns only that child's logs
 * 11.  list with entryType filter returns only that type
 * 12.  list pagination returns page 2 with correct total
 * 13.  getById returns log when found
 * 14.  getById throws when not found
 * 15.  remove non-existent log throws error
 * 16.  update returns updated log
 * 17.  update non-existent throws
 */

import { DevelopmentalMilestoneService } from 'application/services/DevelopmentalMilestoneService';
import { CommunicationLogService } from 'application/services/CommunicationLogService';
import { DevelopmentalMilestone } from 'domain/entities/DevelopmentalMilestone';
import { CommunicationLog } from 'domain/entities/CommunicationLog';
import type { DevelopmentalMilestoneRepository } from 'domain/repositories/DevelopmentalMilestoneRepository';
import type { CommunicationLogRepository } from 'domain/repositories/CommunicationLogRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const MILESTONE_ID = '018f4e8a-0000-7000-8000-000000000001';
const LOG_ID = '018f4e8a-0000-7000-8000-000000000002';
const NOW = new Date('2024-06-15T10:30:00.000Z');

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeMilestone(overrides: Partial<ConstructorParameters<typeof DevelopmentalMilestone>[0]> = {}): DevelopmentalMilestone {
  return new DevelopmentalMilestone({
    id: MILESTONE_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    title: 'Andar',
    category: 'motor_gross',
    status: 'in_progress',
    achievedDate: null,
    targetDate: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeCommunicationLog(overrides: Partial<ConstructorParameters<typeof CommunicationLog>[0]> = {}): CommunicationLog {
  return new CommunicationLog({
    id: LOG_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    occurredAt: NOW,
    entryType: 'vocabulary',
    description: null,
    wordsCount: 50,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeMilestoneRepo(overrides: Partial<DevelopmentalMilestoneRepository> = {}): DevelopmentalMilestoneRepository {
  return {
    save: jest.fn().mockResolvedValue(makeMilestone()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeCommunicationLogRepo(overrides: Partial<CommunicationLogRepository> = {}): CommunicationLogRepository {
  return {
    save: jest.fn().mockResolvedValue(makeCommunicationLog()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DevelopmentalMilestoneService — CRUD
// ---------------------------------------------------------------------------

describe('DevelopmentalMilestoneService — CRUD', () => {
  // 1. create returns DevelopmentalMilestone instance, calls repo.save once
  test('create returns DevelopmentalMilestone and calls repo.save once', async () => {
    const repo = makeMilestoneRepo();
    const service = new DevelopmentalMilestoneService(repo);

    const result = await service.create(
      { childId: CHILD_ID, title: 'Andar', category: 'motor_gross' },
      USER_ID,
    );

    expect(result).toBeInstanceOf(DevelopmentalMilestone);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 2. list with childId filter returns only that child's milestones
  test('list with childId filter returns only that child\'s milestones', async () => {
    const milestoneA = makeMilestone({ id: MILESTONE_ID, childId: CHILD_ID });
    const milestoneB = makeMilestone({ id: '018f4e8a-0000-7000-8000-000000000099', childId: OTHER_CHILD_ID });

    const repo = makeMilestoneRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [milestoneA, milestoneB];
        const data = filters?.childId ? all.filter((m) => m.getChildId() === filters.childId) : all;
        return Promise.resolve(data);
      }),
    });
    const service = new DevelopmentalMilestoneService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result).toHaveLength(1);
    expect(result[0].getChildId()).toBe(CHILD_ID);
  });

  // 3. list with category filter returns only that category's milestones
  test('list with category filter returns only that category\'s milestones', async () => {
    const motorMilestone = makeMilestone({ category: 'motor_gross' });
    const langMilestone = makeMilestone({
      id: '018f4e8a-0000-7000-8000-000000000003',
      category: 'language',
    });

    const repo = makeMilestoneRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [motorMilestone, langMilestone];
        const data = filters?.category ? all.filter((m) => m.getCategory() === filters.category) : all;
        return Promise.resolve(data);
      }),
    });
    const service = new DevelopmentalMilestoneService(repo);

    const result = await service.list(USER_ID, { category: 'language' });
    expect(result).toHaveLength(1);
    expect(result[0].getCategory()).toBe('language');
  });

  // 4. list with status filter returns only milestones with that status
  test('list with status filter returns only milestones with that status', async () => {
    const inProgressMilestone = makeMilestone({ status: 'in_progress' });
    const achievedMilestone = makeMilestone({
      id: '018f4e8a-0000-7000-8000-000000000004',
      status: 'achieved',
    });

    const repo = makeMilestoneRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [inProgressMilestone, achievedMilestone];
        const data = filters?.status ? all.filter((m) => m.getStatus() === filters.status) : all;
        return Promise.resolve(data);
      }),
    });
    const service = new DevelopmentalMilestoneService(repo);

    const result = await service.list(USER_ID, { status: 'achieved' });
    expect(result).toHaveLength(1);
    expect(result[0].getStatus()).toBe('achieved');
    expect(result[0].isAchieved()).toBe(true);
  });

  // 5. getById returns milestone when found
  test('getById returns milestone when found', async () => {
    const milestone = makeMilestone();
    const repo = makeMilestoneRepo({ findById: jest.fn().mockResolvedValue(milestone) });
    const service = new DevelopmentalMilestoneService(repo);

    const result = await service.getById(MILESTONE_ID, USER_ID);
    expect(result).toBeInstanceOf(DevelopmentalMilestone);
    expect(result.getId()).toBe(MILESTONE_ID);
  });

  // 6. getById throws an error containing MILESTONE_ID when not found
  test('getById throws an error containing MILESTONE_ID when not found', async () => {
    const repo = makeMilestoneRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new DevelopmentalMilestoneService(repo);

    await expect(service.getById(MILESTONE_ID, USER_ID)).rejects.toThrow(MILESTONE_ID);
  });

  // 7. update non-existent milestone throws error containing MILESTONE_ID
  test('update non-existent milestone throws error containing MILESTONE_ID', async () => {
    const repo = makeMilestoneRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new DevelopmentalMilestoneService(repo);

    await expect(
      service.update(MILESTONE_ID, { title: 'Correr' }, USER_ID),
    ).rejects.toThrow(MILESTONE_ID);
  });

  // 8. remove non-existent milestone throws error
  test('remove non-existent milestone throws an error', async () => {
    const repo = makeMilestoneRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new DevelopmentalMilestoneService(repo);

    await expect(service.remove(MILESTONE_ID, USER_ID)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CommunicationLogService — CRUD
// ---------------------------------------------------------------------------

describe('CommunicationLogService — CRUD', () => {
  // 9. create returns CommunicationLog instance, calls repo.save once
  test('create returns CommunicationLog and calls repo.save once', async () => {
    const repo = makeCommunicationLogRepo();
    const service = new CommunicationLogService(repo);

    const result = await service.create(
      { childId: CHILD_ID, occurredAt: NOW, entryType: 'vocabulary' },
      USER_ID,
    );

    expect(result).toBeInstanceOf(CommunicationLog);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 10. list with childId filter returns only that child's logs
  test('list with childId filter returns only that child\'s logs', async () => {
    const logA = makeCommunicationLog({ childId: CHILD_ID });
    const logB = makeCommunicationLog({ id: '018f4e8a-0000-7000-8000-000000000099', childId: OTHER_CHILD_ID });

    const toSummary = (l: ReturnType<typeof makeCommunicationLog>) => ({
      id: l.getId(), childId: l.getChildId(), occurredAt: l.getOccurredAt(),
      entryType: l.getEntryType(), description: l.getDescription(),
      wordsCount: l.getWordsCount(), createdAt: l.getCreatedAt(),
    });

    const repo = makeCommunicationLogRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [logA, logB];
        const filtered = filters?.childId ? all.filter((l) => l.getChildId() === filters.childId) : all;
        const data = filtered.map(toSummary);
        return Promise.resolve({ data, total: data.length, page: 1, limit: 20 });
      }),
    });
    const service = new CommunicationLogService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].childId).toBe(CHILD_ID);
  });

  // 11. list with entryType filter returns only that type
  test('list with entryType filter returns only that entry type', async () => {
    const vocabLog = makeCommunicationLog({ entryType: 'vocabulary' });
    const aacLog = makeCommunicationLog({
      id: '018f4e8a-0000-7000-8000-000000000005',
      entryType: 'aac_usage',
    });

    const toSummary = (l: ReturnType<typeof makeCommunicationLog>) => ({
      id: l.getId(), childId: l.getChildId(), occurredAt: l.getOccurredAt(),
      entryType: l.getEntryType(), description: l.getDescription(),
      wordsCount: l.getWordsCount(), createdAt: l.getCreatedAt(),
    });

    const repo = makeCommunicationLogRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [vocabLog, aacLog];
        const filtered = filters?.entryType ? all.filter((l) => l.getEntryType() === filters.entryType) : all;
        const data = filtered.map(toSummary);
        return Promise.resolve({ data, total: data.length, page: 1, limit: 20 });
      }),
    });
    const service = new CommunicationLogService(repo);

    const result = await service.list(USER_ID, { entryType: 'aac_usage' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].entryType).toBe('aac_usage');
  });

  // 12. list pagination returns page 2 with correct total
  test('list pagination returns page 2 with correct total', async () => {
    const logSummary = {
      id: LOG_ID,
      childId: CHILD_ID,
      occurredAt: NOW,
      entryType: 'vocabulary' as const,
      description: null,
      wordsCount: 50,
      createdAt: NOW,
    };

    const repo = makeCommunicationLogRepo({
      findAllByUser: jest.fn().mockResolvedValue({
        data: [logSummary],
        total: 15,
        page: 2,
        limit: 5,
      }),
    });
    const service = new CommunicationLogService(repo);

    const result = await service.list(USER_ID, { page: 2, limit: 5 });
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.data).toHaveLength(1);
  });

  // 13. getById returns log when found
  test('getById returns log when found', async () => {
    const log = makeCommunicationLog();
    const repo = makeCommunicationLogRepo({ findById: jest.fn().mockResolvedValue(log) });
    const service = new CommunicationLogService(repo);

    const result = await service.getById(LOG_ID, USER_ID);
    expect(result).toBeInstanceOf(CommunicationLog);
    expect(result.getId()).toBe(LOG_ID);
  });

  // 14. getById throws when not found
  test('getById throws an error containing LOG_ID when not found', async () => {
    const repo = makeCommunicationLogRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new CommunicationLogService(repo);

    await expect(service.getById(LOG_ID, USER_ID)).rejects.toThrow(LOG_ID);
  });

  // 15. remove non-existent log throws error
  test('remove non-existent log throws an error', async () => {
    const repo = makeCommunicationLogRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new CommunicationLogService(repo);

    await expect(service.remove(LOG_ID, USER_ID)).rejects.toThrow();
  });

  // 16. update returns updated log
  test('update returns updated CommunicationLog', async () => {
    const updatedLog = makeCommunicationLog({ wordsCount: 75 });
    const repo = makeCommunicationLogRepo({ update: jest.fn().mockResolvedValue(updatedLog) });
    const service = new CommunicationLogService(repo);

    const result = await service.update(LOG_ID, { wordsCount: 75 }, USER_ID);
    expect(result).toBeInstanceOf(CommunicationLog);
    expect(result.getWordsCount()).toBe(75);
  });

  // 17. update non-existent throws
  test('update non-existent log throws an error containing LOG_ID', async () => {
    const repo = makeCommunicationLogRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new CommunicationLogService(repo);

    await expect(
      service.update(LOG_ID, { wordsCount: 100 }, USER_ID),
    ).rejects.toThrow(LOG_ID);
  });
});
