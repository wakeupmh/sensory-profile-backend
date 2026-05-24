/**
 * Unit tests for therapySessionValidation Zod schemas.
 *
 * Tests:
 *  1.  Valid session (childId UUID, valid therapyType, ISO datetime occurredAt) passes
 *  2.  Session without therapistId passes
 *  3.  Session without durationMinutes passes
 *  4.  childId must be UUID — plain string fails
 *  5.  therapyType must be valid — 'yoga' fails
 *  6.  occurredAt must be ISO datetime — 'not-a-date' fails
 *  7.  durationMinutes must be positive int, max 480 — 0 fails, 481 fails, 50 passes
 *  8.  therapistId must be UUID when present — invalid string fails; null passes; undefined passes
 *  9.  notes max 2000 chars
 * 10.  updateSessionSchema: all fields optional — empty object passes
 * 11.  updateSessionSchema: childId NOT in schema — childId in body is ignored (stripped)
 * 12.  listSessionFiltersSchema defaults: page=1, limit=20
 * 13.  listSessionFiltersSchema string coercion: page='2' → 2
 * 14.  listSessionFiltersSchema limit max 100: limit='200' fails
 * 15.  invalid therapyType in filters rejects
 */

import {
  createSessionSchema,
  updateSessionSchema,
  listSessionFiltersSchema,
} from '../therapySessionValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const VALID_THERAPIST_ID = '018f4e8a-0000-7000-8000-cccccccccccc';
const VALID_OCCURRED_AT = '2024-06-15T10:30:00.000Z';

const VALID_SESSION = {
  childId: VALID_CHILD_ID,
  therapyType: 'aba',
  occurredAt: VALID_OCCURRED_AT,
} as const;

// ---------------------------------------------------------------------------
// createSessionSchema
// ---------------------------------------------------------------------------

describe('createSessionSchema', () => {
  // 1. Valid session passes
  test('valid session with required fields passes', () => {
    const result = createSessionSchema.safeParse(VALID_SESSION);
    expect(result.success).toBe(true);
  });

  // 2. Session without therapistId passes
  test('session without therapistId passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION });
    expect(result.success).toBe(true);
  });

  // 3. Session without durationMinutes passes
  test('session without durationMinutes passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION });
    expect(result.success).toBe(true);
  });

  // 4. childId must be UUID
  test('non-UUID childId fails', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  // 5. therapyType must be valid
  test("therapyType 'yoga' fails", () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, therapyType: 'yoga' });
    expect(result.success).toBe(false);
  });

  // 6. occurredAt must be ISO datetime
  test("occurredAt 'not-a-date' fails", () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, occurredAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  // 7. durationMinutes constraints
  test('durationMinutes = 0 fails (must be positive)', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  test('durationMinutes = 481 fails (max 480)', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, durationMinutes: 481 });
    expect(result.success).toBe(false);
  });

  test('durationMinutes = 50 passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, durationMinutes: 50 });
    expect(result.success).toBe(true);
  });

  test('durationMinutes = 480 passes (boundary)', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, durationMinutes: 480 });
    expect(result.success).toBe(true);
  });

  // 8. therapistId must be UUID when present
  test('therapistId as invalid string fails', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, therapistId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('therapistId as null passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, therapistId: null });
    expect(result.success).toBe(true);
  });

  test('therapistId as undefined passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, therapistId: undefined });
    expect(result.success).toBe(true);
  });

  test('therapistId as valid UUID passes', () => {
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, therapistId: VALID_THERAPIST_ID });
    expect(result.success).toBe(true);
  });

  // 9. notes max 2000 chars
  test('notes longer than 2000 chars fails', () => {
    const notes = 'x'.repeat(2001);
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, notes });
    expect(result.success).toBe(false);
  });

  test('notes exactly 2000 chars passes', () => {
    const notes = 'x'.repeat(2000);
    const result = createSessionSchema.safeParse({ ...VALID_SESSION, notes });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateSessionSchema
// ---------------------------------------------------------------------------

describe('updateSessionSchema', () => {
  // 10. All fields optional — empty object passes
  test('empty object passes (all fields optional)', () => {
    const result = updateSessionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 11. childId NOT in schema — childId in body is stripped/ignored
  test('childId in body is omitted from parsed output', () => {
    const result = updateSessionSchema.safeParse({
      therapyType: 'ot',
      childId: VALID_CHILD_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('childId' in result.data).toBe(false);
    }
  });

  test('partial update with only therapyType passes', () => {
    const result = updateSessionSchema.safeParse({ therapyType: 'fonoaudiologia' });
    expect(result.success).toBe(true);
  });

  test('invalid therapyType in update fails', () => {
    const result = updateSessionSchema.safeParse({ therapyType: 'yoga' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listSessionFiltersSchema
// ---------------------------------------------------------------------------

describe('listSessionFiltersSchema', () => {
  // 12. Defaults: page=1, limit=20
  test('empty input yields page=1, limit=20 defaults', () => {
    const result = listSessionFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  // 13. String coercion: page='2' → 2
  test("page='2' is coerced to number 2", () => {
    const result = listSessionFiltersSchema.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
    }
  });

  test("limit='50' is coerced to number 50", () => {
    const result = listSessionFiltersSchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  // 14. limit max 100: limit='200' fails
  test("limit='200' fails (max 100)", () => {
    const result = listSessionFiltersSchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  test('limit=100 passes (boundary)', () => {
    const result = listSessionFiltersSchema.safeParse({ limit: '100' });
    expect(result.success).toBe(true);
  });

  // 15. Invalid therapyType in filters rejects
  test("therapyType 'yoga' in filters rejects", () => {
    const result = listSessionFiltersSchema.safeParse({ therapyType: 'yoga' });
    expect(result.success).toBe(false);
  });

  test('valid therapyType in filters passes', () => {
    const result = listSessionFiltersSchema.safeParse({ therapyType: 'psicologia' });
    expect(result.success).toBe(true);
  });

  test('childId filter must be UUID', () => {
    const result = listSessionFiltersSchema.safeParse({ childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('valid childId UUID in filters passes', () => {
    const result = listSessionFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });
});
