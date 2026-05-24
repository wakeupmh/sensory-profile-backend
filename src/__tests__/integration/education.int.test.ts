/**
 * Integration tests for EducationPlanService and SchoolCommunicationService.
 *
 * Tests exercise services against mock repositories — no real database
 * connection required. All repository methods are mocked via jest.fn().
 *
 * EducationPlanService tests:
 *  1.  create returns EducationPlan instance, calls repo.save once
 *  2.  list with childId filter returns only that child's plans
 *  3.  list with academicYear filter returns only plans with that year
 *  4.  getById returns plan when found
 *  5.  getById throws an error containing PLAN_ID when not found
 *  6.  update returns updated EducationPlan
 *  7.  update non-existent plan throws error containing PLAN_ID
 *  8.  remove non-existent plan throws error
 *
 * SchoolCommunicationService tests:
 *  9.  create returns SchoolCommunication instance, calls repo.save once
 * 10.  list with childId filter returns only that child's comms
 * 11.  list with commType filter returns only that type
 * 12.  list pagination returns page 2 with correct total
 * 13.  getById returns comm when found
 * 14.  getById throws an error containing COMM_ID when not found
 * 15.  update returns updated SchoolCommunication
 * 16.  update non-existent comm throws error containing COMM_ID
 * 17.  remove non-existent comm throws error
 */

import { EducationPlanService } from 'application/services/EducationPlanService';
import { SchoolCommunicationService } from 'application/services/SchoolCommunicationService';
import { EducationPlan } from 'domain/entities/EducationPlan';
import { SchoolCommunication } from 'domain/entities/SchoolCommunication';
import type { EducationPlanRepository } from 'domain/repositories/EducationPlanRepository';
import type { SchoolCommunicationRepository } from 'domain/repositories/SchoolCommunicationRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const PLAN_ID = '018f4e8a-0000-7000-8000-000000000001';
const COMM_ID = '018f4e8a-0000-7000-8000-000000000002';
const NOW = new Date('2024-06-15T10:30:00.000Z');

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makePlan(overrides = {}): EducationPlan {
  return new EducationPlan({
    id: PLAN_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    schoolName: 'EMEF São Paulo',
    academicYear: '2024',
    planType: 'pei',
    startDate: '2024-02-01',
    reviewDate: null,
    endDate: null,
    goals: null,
    accommodations: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeComm(overrides = {}): SchoolCommunication {
  return new SchoolCommunication({
    id: COMM_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    occurredAt: NOW,
    commType: 'reuniao',
    subject: 'Reunião de acompanhamento',
    description: null,
    attendees: null,
    followUpDate: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeCommSummary(overrides = {}) {
  return {
    id: COMM_ID,
    childId: CHILD_ID,
    occurredAt: NOW,
    commType: 'reuniao' as const,
    subject: 'Reunião de acompanhamento',
    attendees: null,
    followUpDate: null,
    createdAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock repo factories
// ---------------------------------------------------------------------------

function makePlanRepo(overrides: Partial<EducationPlanRepository> = {}): EducationPlanRepository {
  return {
    save: jest.fn().mockResolvedValue(makePlan()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeCommRepo(overrides: Partial<SchoolCommunicationRepository> = {}): SchoolCommunicationRepository {
  return {
    save: jest.fn().mockResolvedValue(makeComm()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EducationPlanService — CRUD
// ---------------------------------------------------------------------------

describe('EducationPlanService — CRUD', () => {
  // 1. create returns EducationPlan instance, calls repo.save once
  test('create returns EducationPlan and calls repo.save once', async () => {
    const repo = makePlanRepo();
    const service = new EducationPlanService(repo);

    const result = await service.create(
      {
        childId: CHILD_ID,
        schoolName: 'EMEF São Paulo',
        academicYear: '2024',
        planType: 'pei',
        startDate: '2024-02-01',
      },
      USER_ID,
    );

    expect(result).toBeInstanceOf(EducationPlan);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 2. list with childId filter returns only that child's plans
  test("list with childId filter returns only that child's plans", async () => {
    const planA = makePlan({ id: PLAN_ID, childId: CHILD_ID });
    const planB = makePlan({ id: '018f4e8a-0000-7000-8000-000000000099', childId: OTHER_CHILD_ID });

    const repo = makePlanRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [planA, planB];
        const data = filters?.childId ? all.filter((p) => p.getChildId() === filters.childId) : all;
        return Promise.resolve(data);
      }),
    });
    const service = new EducationPlanService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result).toHaveLength(1);
    expect(result[0].getChildId()).toBe(CHILD_ID);
  });

  // 3. list with academicYear filter returns only plans with that year
  test('list with academicYear filter returns only plans with that year', async () => {
    const plan2024 = makePlan({ academicYear: '2024' });
    const plan2023 = makePlan({
      id: '018f4e8a-0000-7000-8000-000000000003',
      academicYear: '2023',
    });

    const repo = makePlanRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [plan2024, plan2023];
        const data = filters?.academicYear
          ? all.filter((p) => p.getAcademicYear() === filters.academicYear)
          : all;
        return Promise.resolve(data);
      }),
    });
    const service = new EducationPlanService(repo);

    const result = await service.list(USER_ID, { academicYear: '2023' });
    expect(result).toHaveLength(1);
    expect(result[0].getAcademicYear()).toBe('2023');
  });

  // 4. getById returns plan when found
  test('getById returns plan when found', async () => {
    const plan = makePlan();
    const repo = makePlanRepo({ findById: jest.fn().mockResolvedValue(plan) });
    const service = new EducationPlanService(repo);

    const result = await service.getById(PLAN_ID, USER_ID);
    expect(result).toBeInstanceOf(EducationPlan);
    expect(result.getId()).toBe(PLAN_ID);
  });

  // 5. getById throws an error containing PLAN_ID when not found
  test('getById throws an error containing PLAN_ID when not found', async () => {
    const repo = makePlanRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new EducationPlanService(repo);

    await expect(service.getById(PLAN_ID, USER_ID)).rejects.toThrow(PLAN_ID);
  });

  // 6. update returns updated EducationPlan
  test('update returns updated EducationPlan', async () => {
    const updatedPlan = makePlan({ schoolName: 'EMEF Nova Esperança' });
    const repo = makePlanRepo({ update: jest.fn().mockResolvedValue(updatedPlan) });
    const service = new EducationPlanService(repo);

    const result = await service.update(PLAN_ID, { schoolName: 'EMEF Nova Esperança' }, USER_ID);
    expect(result).toBeInstanceOf(EducationPlan);
    expect(result.getSchoolName()).toBe('EMEF Nova Esperança');
  });

  // 7. update non-existent plan throws error containing PLAN_ID
  test('update non-existent plan throws error containing PLAN_ID', async () => {
    const repo = makePlanRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new EducationPlanService(repo);

    await expect(
      service.update(PLAN_ID, { schoolName: 'EMEF Nova' }, USER_ID),
    ).rejects.toThrow(PLAN_ID);
  });

  // 8. remove non-existent plan throws error
  test('remove non-existent plan throws an error', async () => {
    const repo = makePlanRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new EducationPlanService(repo);

    await expect(service.remove(PLAN_ID, USER_ID)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SchoolCommunicationService — CRUD
// ---------------------------------------------------------------------------

describe('SchoolCommunicationService — CRUD', () => {
  // 9. create returns SchoolCommunication instance, calls repo.save once
  test('create returns SchoolCommunication and calls repo.save once', async () => {
    const repo = makeCommRepo();
    const service = new SchoolCommunicationService(repo);

    const result = await service.create(
      {
        childId: CHILD_ID,
        occurredAt: NOW,
        commType: 'reuniao',
        subject: 'Reunião de acompanhamento',
      },
      USER_ID,
    );

    expect(result).toBeInstanceOf(SchoolCommunication);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 10. list with childId filter returns only that child's comms
  test("list with childId filter returns only that child's comms", async () => {
    const summaryA = makeCommSummary({ childId: CHILD_ID });
    const summaryB = makeCommSummary({
      id: '018f4e8a-0000-7000-8000-000000000099',
      childId: OTHER_CHILD_ID,
    });

    const repo = makeCommRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [summaryA, summaryB];
        const filtered = filters?.childId
          ? all.filter((s) => s.childId === filters.childId)
          : all;
        return Promise.resolve({ data: filtered, total: filtered.length, page: 1, limit: 20 });
      }),
    });
    const service = new SchoolCommunicationService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].childId).toBe(CHILD_ID);
  });

  // 11. list with commType filter returns only that type
  test('list with commType filter returns only that type', async () => {
    const reuniaoSummary = makeCommSummary({ commType: 'reuniao' as const });
    const emailSummary = makeCommSummary({
      id: '018f4e8a-0000-7000-8000-000000000005',
      commType: 'email' as const,
    });

    const repo = makeCommRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [reuniaoSummary, emailSummary];
        const filtered = filters?.commType
          ? all.filter((s) => s.commType === filters.commType)
          : all;
        return Promise.resolve({ data: filtered, total: filtered.length, page: 1, limit: 20 });
      }),
    });
    const service = new SchoolCommunicationService(repo);

    const result = await service.list(USER_ID, { commType: 'email' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].commType).toBe('email');
  });

  // 12. list pagination returns page 2 with correct total
  test('list pagination returns page 2 with correct total', async () => {
    const summary = makeCommSummary();

    const repo = makeCommRepo({
      findAllByUser: jest.fn().mockResolvedValue({
        data: [summary],
        total: 25,
        page: 2,
        limit: 10,
      }),
    });
    const service = new SchoolCommunicationService(repo);

    const result = await service.list(USER_ID, { page: 2, limit: 10 });
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.data).toHaveLength(1);
  });

  // 13. getById returns comm when found
  test('getById returns comm when found', async () => {
    const comm = makeComm();
    const repo = makeCommRepo({ findById: jest.fn().mockResolvedValue(comm) });
    const service = new SchoolCommunicationService(repo);

    const result = await service.getById(COMM_ID, USER_ID);
    expect(result).toBeInstanceOf(SchoolCommunication);
    expect(result.getId()).toBe(COMM_ID);
  });

  // 14. getById throws an error containing COMM_ID when not found
  test('getById throws an error containing COMM_ID when not found', async () => {
    const repo = makeCommRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new SchoolCommunicationService(repo);

    await expect(service.getById(COMM_ID, USER_ID)).rejects.toThrow(COMM_ID);
  });

  // 15. update returns updated SchoolCommunication
  test('update returns updated SchoolCommunication', async () => {
    const updatedComm = makeComm({ subject: 'Reunião de revisão do PEI' });
    const repo = makeCommRepo({ update: jest.fn().mockResolvedValue(updatedComm) });
    const service = new SchoolCommunicationService(repo);

    const result = await service.update(COMM_ID, { subject: 'Reunião de revisão do PEI' }, USER_ID);
    expect(result).toBeInstanceOf(SchoolCommunication);
    expect(result.getSubject()).toBe('Reunião de revisão do PEI');
  });

  // 16. update non-existent comm throws error containing COMM_ID
  test('update non-existent comm throws error containing COMM_ID', async () => {
    const repo = makeCommRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new SchoolCommunicationService(repo);

    await expect(
      service.update(COMM_ID, { subject: 'Nova reunião' }, USER_ID),
    ).rejects.toThrow(COMM_ID);
  });

  // 17. remove non-existent comm throws error
  test('remove non-existent comm throws an error', async () => {
    const repo = makeCommRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new SchoolCommunicationService(repo);

    await expect(service.remove(COMM_ID, USER_ID)).rejects.toThrow();
  });
});
