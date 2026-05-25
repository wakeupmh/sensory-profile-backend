/**
 * Integration tests for MedicationService, ComorbidityService, and MedicalAppointmentService.
 *
 * Tests exercise services against mock repositories — no real database
 * connection required. All repository methods are mocked via jest.fn().
 *
 * MedicationService tests:
 *  1.  create returns Medication with uuidv7 id
 *  2.  list with childId filter returns only that childs medications
 *  3.  list with active filter returns only active medications
 *  4.  getById returns medication when found
 *  5.  getById throws when not found
 *  6.  remove non-existent medication throws
 *
 * ComorbidityService tests:
 *  7.  create returns Comorbidity
 *  8.  getById throws when not found
 *  9.  remove non-existent throws
 * 10.  update non-existent throws
 * 11.  list returns empty array when no comorbidities
 *
 * MedicalAppointmentService tests:
 * 12.  create returns MedicalAppointment
 * 13.  list pagination returns page 2 with correct total
 * 14.  list with childId filter
 * 15.  getById returns appointment when found
 * 16.  getById throws when not found
 * 17.  remove non-existent throws
 */

import { MedicationService } from 'application/services/MedicationService';
import { ComorbidityService } from 'application/services/ComorbidityService';
import { MedicalAppointmentService } from 'application/services/MedicalAppointmentService';
import { Medication } from 'domain/entities/Medication';
import { Comorbidity } from 'domain/entities/Comorbidity';
import { MedicalAppointment } from 'domain/entities/MedicalAppointment';
import type { MedicationRepository } from 'domain/repositories/MedicationRepository';
import type { ComorbidityRepository } from 'domain/repositories/ComorbidityRepository';
import type { MedicalAppointmentRepository } from 'domain/repositories/MedicalAppointmentRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const MED_ID = '018f4e8a-0000-7000-8000-000000000001';
const COMORBIDITY_ID = '018f4e8a-0000-7000-8000-000000000002';
const APPOINTMENT_ID = '018f4e8a-0000-7000-8000-000000000003';
const NOW = new Date('2024-06-15T10:30:00.000Z');

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeMedication(overrides: Record<string, unknown> = {}): Medication {
  return new Medication({
    id: MED_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    name: 'Ritalin',
    dosage: null,
    frequency: null,
    startDate: null,
    endDate: null,
    prescribingDoctor: null,
    active: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeComorbidity(overrides: Record<string, unknown> = {}): Comorbidity {
  return new Comorbidity({
    id: COMORBIDITY_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    conditionName: 'TDAH',
    icdCode: null,
    diagnosisDate: null,
    diagnosingDoctor: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeAppointment(overrides: Record<string, unknown> = {}): MedicalAppointment {
  return new MedicalAppointment({
    id: APPOINTMENT_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    occurredAt: NOW,
    doctorName: null,
    specialty: null,
    clinicName: null,
    summary: null,
    followUpDate: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeAppointmentSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT_ID,
    childId: CHILD_ID,
    occurredAt: NOW,
    doctorName: null,
    specialty: null,
    clinicName: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeMedRepo(overrides: Partial<MedicationRepository> = {}): MedicationRepository {
  return {
    save: jest.fn().mockResolvedValue(makeMedication()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeComorbidityRepo(overrides: Partial<ComorbidityRepository> = {}): ComorbidityRepository {
  return {
    save: jest.fn().mockResolvedValue(makeComorbidity()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeAppointmentRepo(overrides: Partial<MedicalAppointmentRepository> = {}): MedicalAppointmentRepository {
  return {
    save: jest.fn().mockResolvedValue(makeAppointment()),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MedicationService — CRUD
// ---------------------------------------------------------------------------

describe('MedicationService — CRUD', () => {
  // 1. create returns Medication with uuidv7 id
  test('create returns a Medication instance and calls repo.save once', async () => {
    const med = makeMedication();
    const medRepo = makeMedRepo({ save: jest.fn().mockResolvedValue(med) });
    const service = new MedicationService(medRepo);

    const result = await service.create({ childId: CHILD_ID, name: 'Ritalin' }, USER_ID);

    expect(result).toBeInstanceOf(Medication);
    expect(result.getId()).toBe(MED_ID);
    expect(medRepo.save).toHaveBeenCalledTimes(1);
  });

  // 2. list with childId filter
  test('list with childId filter returns only that childs medications', async () => {
    const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
    const medA = makeMedication({ id: MED_ID, childId: CHILD_ID });
    const medB = makeMedication({ id: '018f4e8a-0000-7000-8000-000000000099', childId: OTHER_CHILD_ID });

    const medRepo = makeMedRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [medA, medB];
        return Promise.resolve(filters?.childId ? all.filter((m) => m.getChildId() === filters.childId) : all);
      }),
    });
    const service = new MedicationService(medRepo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result).toHaveLength(1);
    expect(result[0].getChildId()).toBe(CHILD_ID);
  });

  // 3. list with active filter
  test('list with active filter returns only active medications', async () => {
    const active = makeMedication({ active: true });
    const inactive = makeMedication({ id: '018f4e8a-0000-7000-8000-000000000099', active: false });

    const medRepo = makeMedRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [active, inactive];
        return Promise.resolve(
          filters?.active !== undefined ? all.filter((m) => m.isActive() === filters.active) : all,
        );
      }),
    });
    const service = new MedicationService(medRepo);

    const result = await service.list(USER_ID, { active: true });
    expect(result).toHaveLength(1);
    expect(result[0].isActive()).toBe(true);
  });

  // 4. getById returns medication when found
  test('getById returns the medication when found', async () => {
    const med = makeMedication();
    const medRepo = makeMedRepo({ findById: jest.fn().mockResolvedValue(med) });
    const service = new MedicationService(medRepo);

    const result = await service.getById(MED_ID, USER_ID);
    expect(result).toBeInstanceOf(Medication);
    expect(result.getId()).toBe(MED_ID);
  });

  // 5. getById throws when not found
  test('getById throws an error containing MED_ID when not found', async () => {
    const medRepo = makeMedRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new MedicationService(medRepo);

    await expect(service.getById(MED_ID, USER_ID)).rejects.toThrow(MED_ID);
  });

  // 6. remove non-existent throws
  test('remove non-existent medication throws an error', async () => {
    const medRepo = makeMedRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new MedicationService(medRepo);

    await expect(service.remove(MED_ID, USER_ID)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ComorbidityService — CRUD
// ---------------------------------------------------------------------------

describe('ComorbidityService — CRUD', () => {
  // 7. create returns Comorbidity
  test('create returns a Comorbidity instance', async () => {
    const comorbidity = makeComorbidity();
    const repo = makeComorbidityRepo({ save: jest.fn().mockResolvedValue(comorbidity) });
    const service = new ComorbidityService(repo);

    const result = await service.create({ childId: CHILD_ID, conditionName: 'TDAH' }, USER_ID);

    expect(result).toBeInstanceOf(Comorbidity);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 8. getById throws when not found
  test('getById throws when comorbidity not found', async () => {
    const repo = makeComorbidityRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new ComorbidityService(repo);

    await expect(service.getById(COMORBIDITY_ID, USER_ID)).rejects.toThrow(COMORBIDITY_ID);
  });

  // 9. remove non-existent throws
  test('remove non-existent comorbidity throws an error', async () => {
    const repo = makeComorbidityRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new ComorbidityService(repo);

    await expect(service.remove(COMORBIDITY_ID, USER_ID)).rejects.toThrow();
  });

  // 10. update non-existent throws
  test('update non-existent comorbidity throws an error', async () => {
    const repo = makeComorbidityRepo({ update: jest.fn().mockResolvedValue(null) });
    const service = new ComorbidityService(repo);

    await expect(
      service.update(COMORBIDITY_ID, { conditionName: 'TEA' }, USER_ID),
    ).rejects.toThrow(COMORBIDITY_ID);
  });

  // 11. list returns empty array when no comorbidities
  test('list returns empty array when no comorbidities exist', async () => {
    const repo = makeComorbidityRepo({ findAllByUser: jest.fn().mockResolvedValue([]) });
    const service = new ComorbidityService(repo);

    const result = await service.list(USER_ID, {});
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MedicalAppointmentService — CRUD
// ---------------------------------------------------------------------------

describe('MedicalAppointmentService — CRUD', () => {
  // 12. create returns MedicalAppointment
  test('create returns a MedicalAppointment instance', async () => {
    const appointment = makeAppointment();
    const repo = makeAppointmentRepo({ save: jest.fn().mockResolvedValue(appointment) });
    const service = new MedicalAppointmentService(repo);

    const result = await service.create({ childId: CHILD_ID, occurredAt: NOW }, USER_ID);

    expect(result).toBeInstanceOf(MedicalAppointment);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // 13. list pagination returns page 2 with correct total
  test('list pagination returns page 2 with correct total', async () => {
    const summaryA = makeAppointmentSummary({ id: APPOINTMENT_ID });
    const summaryB = makeAppointmentSummary({ id: '018f4e8a-0000-7000-8000-000000000099' });
    const repo = makeAppointmentRepo({
      findAllByUser: jest.fn().mockResolvedValue({
        data: [summaryB],
        total: 2,
        page: 2,
        limit: 1,
      }),
    });
    const service = new MedicalAppointmentService(repo);

    const result = await service.list(USER_ID, { page: 2, limit: 1 });
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.data).toHaveLength(1);
    // summaryA is unused but declared for clarity
    void summaryA;
  });

  // 14. list with childId filter
  test('list with childId filter returns only that childs appointments', async () => {
    const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
    const apptA = makeAppointmentSummary({ childId: CHILD_ID });
    const apptB = makeAppointmentSummary({ id: '018f4e8a-0000-7000-8000-000000000099', childId: OTHER_CHILD_ID });

    const repo = makeAppointmentRepo({
      findAllByUser: jest.fn().mockImplementation((_userId, filters) => {
        const all = [apptA, apptB];
        const data = filters?.childId ? all.filter((a) => a.childId === filters.childId) : all;
        return Promise.resolve({ data, total: data.length, page: 1, limit: 20 });
      }),
    });
    const service = new MedicalAppointmentService(repo);

    const result = await service.list(USER_ID, { childId: CHILD_ID });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].childId).toBe(CHILD_ID);
  });

  // 15. getById returns appointment when found
  test('getById returns the appointment when found', async () => {
    const appointment = makeAppointment();
    const repo = makeAppointmentRepo({ findById: jest.fn().mockResolvedValue(appointment) });
    const service = new MedicalAppointmentService(repo);

    const result = await service.getById(APPOINTMENT_ID, USER_ID);
    expect(result).toBeInstanceOf(MedicalAppointment);
    expect(result.getId()).toBe(APPOINTMENT_ID);
  });

  // 16. getById throws when not found
  test('getById throws when appointment not found', async () => {
    const repo = makeAppointmentRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new MedicalAppointmentService(repo);

    await expect(service.getById(APPOINTMENT_ID, USER_ID)).rejects.toThrow(APPOINTMENT_ID);
  });

  // 17. remove non-existent throws
  test('remove non-existent appointment throws an error', async () => {
    const repo = makeAppointmentRepo({ delete: jest.fn().mockResolvedValue(false) });
    const service = new MedicalAppointmentService(repo);

    await expect(service.remove(APPOINTMENT_ID, USER_ID)).rejects.toThrow();
  });
});
