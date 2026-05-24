/**
 * Unit tests for medicalValidation Zod schemas.
 *
 * Tests:
 *  1.  createMedicationSchema passes with required fields only
 *  2.  createMedicationSchema passes with all optional fields
 *  3.  createMedicationSchema rejects empty name
 *  4.  createMedicationSchema rejects invalid childId
 *  5.  createMedicationSchema rejects name longer than 255 chars
 *  6.  startDate accepts YYYY-MM-DD format
 *  7.  startDate rejects invalid date string
 *  8.  endDate accepts YYYY-MM-DD format
 *  9.  updateMedicationSchema accepts empty object
 * 10.  listMedicationFiltersSchema transforms active 'true' to boolean true
 * 11.  listMedicationFiltersSchema transforms active 'false' to boolean false
 * 12.  listMedicationFiltersSchema accepts valid uuid childId
 * 13.  createComorbiditySchema passes with required fields only
 * 14.  createComorbiditySchema rejects empty conditionName
 * 15.  updateComorbiditySchema accepts empty object
 * 16.  createAppointmentSchema passes with required fields
 * 17.  createAppointmentSchema rejects missing occurredAt
 * 18.  createAppointmentSchema accepts valid ISO datetime for occurredAt
 * 19.  listAppointmentFiltersSchema defaults page to 1 and limit to 20
 * 20.  listAppointmentFiltersSchema coerces string page to number
 */

import {
  createMedicationSchema,
  updateMedicationSchema,
  listMedicationFiltersSchema,
  createComorbiditySchema,
  updateComorbiditySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentFiltersSchema,
} from '../medicalValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const VALID_MED_BASE = { childId: VALID_CHILD_ID, name: 'Ritalin' } as const;
const VALID_COMORBIDITY_BASE = { childId: VALID_CHILD_ID, conditionName: 'TDAH' } as const;
const VALID_APPOINTMENT_BASE = {
  childId: VALID_CHILD_ID,
  occurredAt: '2024-06-15T10:30:00.000Z',
} as const;

// ---------------------------------------------------------------------------
// createMedicationSchema
// ---------------------------------------------------------------------------

describe('createMedicationSchema', () => {
  // 1. Required fields only
  test('passes with required fields only', () => {
    const result = createMedicationSchema.safeParse(VALID_MED_BASE);
    expect(result.success).toBe(true);
  });

  // 2. All optional fields
  test('passes with all optional fields provided', () => {
    const result = createMedicationSchema.safeParse({
      ...VALID_MED_BASE,
      dosage: '10mg',
      frequency: 'twice daily',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      prescribingDoctor: 'Dr. Santos',
      active: true,
      notes: 'Take with food',
    });
    expect(result.success).toBe(true);
  });

  // 3. Empty name fails
  test('rejects empty name', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, name: '' });
    expect(result.success).toBe(false);
  });

  // 4. Invalid childId fails
  test('rejects invalid childId (not a uuid)', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  // 5. Name > 255 chars fails
  test('rejects name longer than 255 chars', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, name: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  test('accepts name exactly 255 chars', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, name: 'a'.repeat(255) });
    expect(result.success).toBe(true);
  });

  // 6. startDate accepts YYYY-MM-DD
  test('startDate accepts YYYY-MM-DD format', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, startDate: '2024-01-15' });
    expect(result.success).toBe(true);
  });

  // 7. startDate rejects invalid date
  test('startDate rejects invalid date string', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, startDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  // 8. endDate accepts YYYY-MM-DD
  test('endDate accepts YYYY-MM-DD format', () => {
    const result = createMedicationSchema.safeParse({ ...VALID_MED_BASE, endDate: '2024-12-31' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateMedicationSchema
// ---------------------------------------------------------------------------

describe('updateMedicationSchema', () => {
  // 9. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateMedicationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('partial update with only name passes', () => {
    const result = updateMedicationSchema.safeParse({ name: 'Concerta' });
    expect(result.success).toBe(true);
  });

  test('partial update with active false passes', () => {
    const result = updateMedicationSchema.safeParse({ active: false });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listMedicationFiltersSchema
// ---------------------------------------------------------------------------

describe('listMedicationFiltersSchema', () => {
  // 10. active 'true' transforms to boolean true
  test("transforms active 'true' string to boolean true", () => {
    const result = listMedicationFiltersSchema.safeParse({ active: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(true);
  });

  // 11. active 'false' transforms to boolean false
  test("transforms active 'false' string to boolean false", () => {
    const result = listMedicationFiltersSchema.safeParse({ active: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(false);
  });

  // 12. valid uuid childId
  test('accepts valid uuid childId', () => {
    const result = listMedicationFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });

  test('accepts empty object (all optional)', () => {
    const result = listMedicationFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createComorbiditySchema
// ---------------------------------------------------------------------------

describe('createComorbiditySchema', () => {
  // 13. Required fields only
  test('passes with required fields only', () => {
    const result = createComorbiditySchema.safeParse(VALID_COMORBIDITY_BASE);
    expect(result.success).toBe(true);
  });

  // 14. Empty conditionName fails
  test('rejects empty conditionName', () => {
    const result = createComorbiditySchema.safeParse({ ...VALID_COMORBIDITY_BASE, conditionName: '' });
    expect(result.success).toBe(false);
  });

  test('passes with all optional fields', () => {
    const result = createComorbiditySchema.safeParse({
      ...VALID_COMORBIDITY_BASE,
      icdCode: 'F90.0',
      diagnosisDate: '2023-03-10',
      diagnosingDoctor: 'Dr. Lima',
      notes: 'Confirmed by neurologist',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateComorbiditySchema
// ---------------------------------------------------------------------------

describe('updateComorbiditySchema', () => {
  // 15. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateComorbiditySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createAppointmentSchema
// ---------------------------------------------------------------------------

describe('createAppointmentSchema', () => {
  // 16. Required fields
  test('passes with required fields only', () => {
    const result = createAppointmentSchema.safeParse(VALID_APPOINTMENT_BASE);
    expect(result.success).toBe(true);
  });

  // 17. Missing occurredAt fails
  test('rejects missing occurredAt', () => {
    const result = createAppointmentSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(false);
  });

  // 18. Valid ISO datetime
  test('accepts valid ISO datetime for occurredAt', () => {
    const result = createAppointmentSchema.safeParse({
      ...VALID_APPOINTMENT_BASE,
      occurredAt: '2024-06-15T10:30:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('passes with all optional fields', () => {
    const result = createAppointmentSchema.safeParse({
      ...VALID_APPOINTMENT_BASE,
      doctorName: 'Dr. Costa',
      specialty: 'Neuropediatria',
      clinicName: 'Clinic ABC',
      summary: 'Routine checkup',
      followUpDate: '2024-09-15',
      notes: 'No changes to medication',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateAppointmentSchema
// ---------------------------------------------------------------------------

describe('updateAppointmentSchema', () => {
  test('accepts empty object (all fields optional)', () => {
    const result = updateAppointmentSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listAppointmentFiltersSchema
// ---------------------------------------------------------------------------

describe('listAppointmentFiltersSchema', () => {
  // 19. Default values
  test('defaults page to 1 and limit to 20 when not provided', () => {
    const result = listAppointmentFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  // 20. Coerces string page to number
  test("coerces string '2' to number 2 for page", () => {
    const result = listAppointmentFiltersSchema.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  test('accepts valid childId filter', () => {
    const result = listAppointmentFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });

  test('accepts from and to datetime filters', () => {
    const result = listAppointmentFiltersSchema.safeParse({
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('rejects limit above 100', () => {
    const result = listAppointmentFiltersSchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });
});
