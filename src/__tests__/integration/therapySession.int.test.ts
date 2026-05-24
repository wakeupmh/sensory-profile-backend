/**
 * Integration tests for TherapySessionService and TherapistService CRUD operations.
 *
 * These tests exercise services against mock repositories — no real database
 * connection required. All repository methods are mocked via jest.fn().
 *
 * TherapySessionService tests:
 *  1.  create without therapistId → succeeds (therapistRepo.findById not called)
 *  2.  create with valid therapistId (therapistRepo.findById returns therapist) → succeeds
 *  3.  create with invalid therapistId (therapistRepo.findById returns null) → throws
 *  4.  list with childId filter → only that child's sessions returned
 *  5.  list with therapyType filter → only that type returned
 *  6.  list pagination → page 2, total correct
 *  7.  update changes fields, preserves others
 *  8.  delete removes; subsequent findById null
 *  9.  delete non-existent → throws
 * 10.  getById throws when not found
 * 11.  getById returns session when found
 *
 * TherapistService tests:
 * 12.  create + findAllByUser → therapist in list
 * 13.  getById throws when not found
 * 14.  remove non-existent → throws
 * 15.  update non-existent → throws
 */

import { TherapySessionService } from 'application/services/TherapySessionService';
import { TherapistService } from 'application/services/TherapistService';
import { TherapySession, TherapySessionSummary } from 'domain/entities/TherapySession';
import { Therapist } from 'domain/entities/Therapist';
import { TherapySessionRepository } from 'domain/repositories/TherapySessionRepository';
import { TherapistRepository } from 'domain/repositories/TherapistRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const OTHER_USER_ID = 'user-002';
const CHILD_ID_A = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const CHILD_ID_B = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const THERAPIST_ID = '018f4e8a-0000-7000-8000-cccccccccccc';
const SESSION_ID_1 = '018f4e8a-0000-7000-8000-000000000001';
const SESSION_ID_2 = '018f4e8a-0000-7000-8000-000000000002';
const NOW = new Date('2024-06-15T10:30:00.000Z');

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeTherapist(overrides: Partial<Parameters<typeof Therapist.prototype.constructor>[0]> = {}): Therapist {
  return new Therapist({
    id: THERAPIST_ID,
    userId: USER_ID,
    name: 'Dr. Silva',
    specialty: 'aba',
    phone: null,
    email: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeSession(overrides: Record<string, unknown> = {}): TherapySession {
  return new TherapySession({
    id: SESSION_ID_1,
    userId: USER_ID,
    childId: CHILD_ID_A,
    therapistId: null,
    therapyType: 'aba',
    occurredAt: NOW,
    durationMinutes: 45,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeSessionSummary(overrides: Partial<TherapySessionSummary> = {}): TherapySessionSummary {
  return {
    id: SESSION_ID_1,
    childId: CHILD_ID_A,
    therapistId: null,
    therapyType: 'aba',
    occurredAt: NOW,
    durationMinutes: 45,
    notes: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeSessionRepo(overrides: Partial<TherapySessionRepository> = {}): TherapySessionRepository {
  return {
    save: jest.fn().mockImplementation((input) =>
      Promise.resolve(makeSession({ ...input }))
    ),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeTherapistRepo(overrides: Partial<TherapistRepository> = {}): TherapistRepository {
  return {
    save: jest.fn().mockImplementation((input) =>
      Promise.resolve(makeTherapist(input))
    ),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TherapySessionService — CRUD
// ---------------------------------------------------------------------------

describe('TherapySessionService — CRUD', () => {
  // 1. create without therapistId
  test('create without therapistId succeeds and does not call therapistRepo.findById', async () => {
    const sessionRepo = makeSessionRepo({
      save: jest.fn().mockResolvedValue(makeSession()),
    });
    const therapistRepo = makeTherapistRepo();
    const service = new TherapySessionService(sessionRepo, therapistRepo);

    const result = await service.create(
      { childId: CHILD_ID_A, therapyType: 'aba', occurredAt: NOW },
      USER_ID,
    );

    expect(result).toBeInstanceOf(TherapySession);
    expect(therapistRepo.findById).not.toHaveBeenCalled();
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });

  // 2. create with valid therapistId
  test('create with valid therapistId resolves therapist and succeeds', async () => {
    const therapist = makeTherapist();
    const session = makeSession({ therapistId: THERAPIST_ID });
    const sessionRepo = makeSessionRepo({ save: jest.fn().mockResolvedValue(session) });
    const therapistRepo = makeTherapistRepo({
      findById: jest.fn().mockResolvedValue(therapist),
    });
    const service = new TherapySessionService(sessionRepo, therapistRepo);

    const result = await service.create(
      { childId: CHILD_ID_A, therapyType: 'aba', occurredAt: NOW, therapistId: THERAPIST_ID },
      USER_ID,
    );

    expect(result).toBeInstanceOf(TherapySession);
    expect(therapistRepo.findById).toHaveBeenCalledWith(THERAPIST_ID, USER_ID);
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });

  // 3. create with invalid therapistId
  test('create with unknown therapistId throws an error', async () => {
    const sessionRepo = makeSessionRepo();
    const therapistRepo = makeTherapistRepo({
      findById: jest.fn().mockResolvedValue(null),
    });
    const service = new TherapySessionService(sessionRepo, therapistRepo);

    await expect(
      service.create(
        { childId: CHILD_ID_A, therapyType: 'aba', occurredAt: NOW, therapistId: THERAPIST_ID },
        USER_ID,
      ),
    ).rejects.toThrow(THERAPIST_ID);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  // 4. list with childId filter
  test('list with childId filter returns only that childs sessions', async () => {
    const summaryA = makeSessionSummary({ id: SESSION_ID_1, childId: CHILD_ID_A });
    const summaryB = makeSessionSummary({ id: SESSION_ID_2, childId: CHILD_ID_B });

    const sessionRepo = makeSessionRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [summaryA, summaryB];
        const data = filters.childId ? all.filter((s) => s.childId === filters.childId) : all;
        return Promise.resolve({ data, total: data.length, page: 1, limit: 20 });
      }),
    });
    const therapistRepo = makeTherapistRepo();
    const service = new TherapySessionService(sessionRepo, therapistRepo);

    const result = await service.list(USER_ID, { childId: CHILD_ID_A });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].childId).toBe(CHILD_ID_A);
  });

  // 5. list with therapyType filter
  test('list with therapyType filter returns only that type', async () => {
    const summaryAba = makeSessionSummary({ therapyType: 'aba' });
    const summaryOt = makeSessionSummary({ id: SESSION_ID_2, therapyType: 'ot' });

    const sessionRepo = makeSessionRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [summaryAba, summaryOt];
        const data = filters.therapyType
          ? all.filter((s) => s.therapyType === filters.therapyType)
          : all;
        return Promise.resolve({ data, total: data.length, page: 1, limit: 20 });
      }),
    });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    const result = await service.list(USER_ID, { therapyType: 'ot' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].therapyType).toBe('ot');
  });

  // 6. list pagination — page 2, total correct
  test('list pagination returns page 2 with correct total', async () => {
    const sessionRepo = makeSessionRepo({
      findAllByUser: jest.fn().mockResolvedValue({
        data: [makeSessionSummary({ id: SESSION_ID_2 })],
        total: 15,
        page: 2,
        limit: 10,
      }),
    });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    const result = await service.list(USER_ID, { page: 2, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.total).toBe(15);
    expect(result.data).toHaveLength(1);
  });

  // 7. update changes fields, preserves others
  test('update returns the updated session with changed fields', async () => {
    const original = makeSession({ notes: 'old note', therapyType: 'aba' });
    const updated = makeSession({ notes: 'new note', therapyType: 'aba' });

    const sessionRepo = makeSessionRepo({
      update: jest.fn().mockResolvedValue(updated),
    });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    const result = await service.update(SESSION_ID_1, { notes: 'new note' }, USER_ID);
    expect(result.getNotes()).toBe('new note');
    // therapyType unchanged
    expect(result.getTherapyType()).toBe('aba');
    expect(result.getId()).toBe(original.getId());
  });

  // 8. delete removes; subsequent findById null
  test('delete removes the session; subsequent findById returns null', async () => {
    const findByIdMock = jest.fn()
      .mockResolvedValueOnce(makeSession())  // first call: exists
      .mockResolvedValueOnce(null);          // second call: deleted

    const sessionRepo = makeSessionRepo({
      delete: jest.fn().mockResolvedValue(true),
      findById: findByIdMock,
    });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    const before = await sessionRepo.findById(SESSION_ID_1, USER_ID);
    expect(before).not.toBeNull();

    await service.remove(SESSION_ID_1, USER_ID);
    expect(sessionRepo.delete).toHaveBeenCalledWith(SESSION_ID_1, USER_ID);

    const after = await sessionRepo.findById(SESSION_ID_1, USER_ID);
    expect(after).toBeNull();
  });

  // 9. delete non-existent → throws
  test('remove non-existent session throws an error', async () => {
    const sessionRepo = makeSessionRepo({
      delete: jest.fn().mockResolvedValue(false),
    });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    await expect(service.remove(SESSION_ID_1, USER_ID)).rejects.toThrow(SESSION_ID_1);
  });
});

// ---------------------------------------------------------------------------
// TherapySessionService.getById
// ---------------------------------------------------------------------------

describe('TherapySessionService.getById', () => {
  // 10. getById throws when not found
  test('getById throws when session not found', async () => {
    const sessionRepo = makeSessionRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    await expect(service.getById(SESSION_ID_1, USER_ID)).rejects.toThrow(SESSION_ID_1);
  });

  // 11. getById returns session when found
  test('getById returns the session when found', async () => {
    const session = makeSession();
    const sessionRepo = makeSessionRepo({ findById: jest.fn().mockResolvedValue(session) });
    const service = new TherapySessionService(sessionRepo, makeTherapistRepo());

    const result = await service.getById(SESSION_ID_1, USER_ID);
    expect(result.getId()).toBe(SESSION_ID_1);
    expect(result).toBeInstanceOf(TherapySession);
  });
});

// ---------------------------------------------------------------------------
// TherapistService — CRUD
// ---------------------------------------------------------------------------

describe('TherapistService — CRUD', () => {
  // 12. create + findAllByUser → therapist in list
  test('created therapist appears in findAllByUser result', async () => {
    const therapist = makeTherapist();
    const therapistRepo = makeTherapistRepo({
      save: jest.fn().mockResolvedValue(therapist),
      findAllByUser: jest.fn().mockResolvedValue([therapist]),
    });
    const service = new TherapistService(therapistRepo);

    await service.create({ name: 'Dr. Silva', specialty: 'aba' }, USER_ID);
    const list = await service.list(USER_ID);

    expect(list).toHaveLength(1);
    expect(list[0].getName()).toBe('Dr. Silva');
    expect(list[0].getSpecialty()).toBe('aba');
  });

  // 13. getById throws when not found
  test('getById throws when therapist not found', async () => {
    const therapistRepo = makeTherapistRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new TherapistService(therapistRepo);

    await expect(service.getById(THERAPIST_ID, USER_ID)).rejects.toThrow(THERAPIST_ID);
  });

  // 14. remove non-existent → throws
  test('remove non-existent therapist throws an error', async () => {
    const therapistRepo = makeTherapistRepo({
      delete: jest.fn().mockResolvedValue(false),
    });
    const service = new TherapistService(therapistRepo);

    await expect(service.remove(THERAPIST_ID, USER_ID)).rejects.toThrow(THERAPIST_ID);
  });

  // 15. update non-existent → throws
  test('update non-existent therapist throws an error', async () => {
    const therapistRepo = makeTherapistRepo({
      update: jest.fn().mockResolvedValue(null),
    });
    const service = new TherapistService(therapistRepo);

    await expect(
      service.update(THERAPIST_ID, { name: 'Dr. New' }, USER_ID),
    ).rejects.toThrow(THERAPIST_ID);
  });

  test('getById returns therapist when found', async () => {
    const therapist = makeTherapist();
    const therapistRepo = makeTherapistRepo({ findById: jest.fn().mockResolvedValue(therapist) });
    const service = new TherapistService(therapistRepo);

    const result = await service.getById(THERAPIST_ID, USER_ID);
    expect(result.getId()).toBe(THERAPIST_ID);
    expect(result).toBeInstanceOf(Therapist);
  });

  test('list returns empty array when no therapists exist', async () => {
    const therapistRepo = makeTherapistRepo({ findAllByUser: jest.fn().mockResolvedValue([]) });
    const service = new TherapistService(therapistRepo);

    const result = await service.list(USER_ID);
    expect(result).toEqual([]);
  });
});
