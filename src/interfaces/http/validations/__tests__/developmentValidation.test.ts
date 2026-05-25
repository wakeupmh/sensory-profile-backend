/**
 * Unit tests for developmentValidation Zod schemas.
 *
 * Tests:
 *  1.  createMilestoneSchema passes with required fields only
 *  2.  createMilestoneSchema passes with all optional fields
 *  3.  createMilestoneSchema rejects missing childId
 *  4.  createMilestoneSchema rejects invalid category enum
 *  5.  createMilestoneSchema rejects title longer than 255 chars
 *  6.  createMilestoneSchema rejects achievedDate with invalid format
 *  7.  updateMilestoneSchema accepts empty object
 *  8.  updateMilestoneSchema rejects invalid status enum
 *  9.  updateMilestoneSchema accepts valid status update
 * 10.  listMilestoneFiltersSchema accepts empty object
 * 11.  listMilestoneFiltersSchema accepts valid category and status
 * 12.  listMilestoneFiltersSchema rejects invalid category
 * 13.  createCommunicationLogSchema passes with required fields only
 * 14.  createCommunicationLogSchema passes with all optional fields
 * 15.  createCommunicationLogSchema rejects missing occurredAt
 * 16.  createCommunicationLogSchema rejects invalid entryType
 * 17.  createCommunicationLogSchema rejects negative wordsCount
 * 18.  createCommunicationLogSchema rejects non-integer wordsCount
 * 19.  updateCommunicationLogSchema accepts empty object
 * 20.  updateCommunicationLogSchema accepts wordsCount null
 * 21.  listCommunicationLogFiltersSchema accepts empty object (defaults page=1 limit=20)
 * 22.  listCommunicationLogFiltersSchema coerces string page "2" to number 2
 * 23.  listCommunicationLogFiltersSchema rejects invalid entryType
 * 24.  createMilestoneSchema rejects missing title
 * 25.  createCommunicationLogSchema rejects missing childId
 */

import {
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestoneFiltersSchema,
  createCommunicationLogSchema,
  updateCommunicationLogSchema,
  listCommunicationLogFiltersSchema,
} from '../developmentValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';

const VALID_MILESTONE_BASE = {
  childId: VALID_CHILD_ID,
  title: 'Andar',
  category: 'motor_gross',
} as const;

const VALID_COMM_LOG_BASE = {
  childId: VALID_CHILD_ID,
  occurredAt: '2024-06-15T10:30:00.000Z',
  entryType: 'vocabulary',
} as const;

// ---------------------------------------------------------------------------
// createMilestoneSchema
// ---------------------------------------------------------------------------

describe('createMilestoneSchema', () => {
  // 1. Required fields only
  test('passes with required fields only', () => {
    const result = createMilestoneSchema.safeParse(VALID_MILESTONE_BASE);
    expect(result.success).toBe(true);
  });

  // 2. All optional fields
  test('passes with all optional fields provided', () => {
    const result = createMilestoneSchema.safeParse({
      ...VALID_MILESTONE_BASE,
      status: 'in_progress',
      achievedDate: '2024-05-01',
      targetDate: '2024-07-01',
      notes: 'Progressing well',
    });
    expect(result.success).toBe(true);
  });

  // 3. Missing childId
  test('rejects missing childId', () => {
    const result = createMilestoneSchema.safeParse({ title: 'Andar', category: 'motor_gross' });
    expect(result.success).toBe(false);
  });

  // 4. Invalid category enum
  test('rejects invalid category enum', () => {
    const result = createMilestoneSchema.safeParse({ ...VALID_MILESTONE_BASE, category: 'invalid_cat' });
    expect(result.success).toBe(false);
  });

  // 5. Title too long (>255 chars)
  test('rejects title longer than 255 characters', () => {
    const result = createMilestoneSchema.safeParse({
      ...VALID_MILESTONE_BASE,
      title: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  // 6. achievedDate invalid format
  test('rejects achievedDate with invalid date format', () => {
    const result = createMilestoneSchema.safeParse({
      ...VALID_MILESTONE_BASE,
      achievedDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  // 24. Missing title
  test('rejects missing title', () => {
    const result = createMilestoneSchema.safeParse({ childId: VALID_CHILD_ID, category: 'language' });
    expect(result.success).toBe(false);
  });

  test('passes with null achievedDate and targetDate', () => {
    const result = createMilestoneSchema.safeParse({
      ...VALID_MILESTONE_BASE,
      achievedDate: null,
      targetDate: null,
    });
    expect(result.success).toBe(true);
  });

  test('passes with all valid category values', () => {
    const categories = ['motor_gross', 'motor_fine', 'language', 'communication', 'social', 'cognitive', 'self_care', 'other'];
    for (const category of categories) {
      const result = createMilestoneSchema.safeParse({ ...VALID_MILESTONE_BASE, category });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateMilestoneSchema
// ---------------------------------------------------------------------------

describe('updateMilestoneSchema', () => {
  // 7. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateMilestoneSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 8. Invalid status enum
  test('rejects invalid status enum', () => {
    const result = updateMilestoneSchema.safeParse({ status: 'flying' });
    expect(result.success).toBe(false);
  });

  // 9. Valid status update
  test('accepts valid status update', () => {
    const result = updateMilestoneSchema.safeParse({ status: 'achieved' });
    expect(result.success).toBe(true);
  });

  test('accepts partial update with only title', () => {
    const result = updateMilestoneSchema.safeParse({ title: 'Correr' });
    expect(result.success).toBe(true);
  });

  test('passes with all valid status values', () => {
    const statuses = ['not_yet', 'in_progress', 'achieved', 'regressed'];
    for (const status of statuses) {
      const result = updateMilestoneSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// listMilestoneFiltersSchema
// ---------------------------------------------------------------------------

describe('listMilestoneFiltersSchema', () => {
  // 10. Empty passes
  test('accepts empty object (all optional)', () => {
    const result = listMilestoneFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 11. Valid category + status
  test('accepts valid category and status filters', () => {
    const result = listMilestoneFiltersSchema.safeParse({
      childId: VALID_CHILD_ID,
      category: 'language',
      status: 'in_progress',
    });
    expect(result.success).toBe(true);
  });

  // 12. Invalid category
  test('rejects invalid category value', () => {
    const result = listMilestoneFiltersSchema.safeParse({ category: 'unknown' });
    expect(result.success).toBe(false);
  });

  test('accepts valid childId uuid', () => {
    const result = listMilestoneFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createCommunicationLogSchema
// ---------------------------------------------------------------------------

describe('createCommunicationLogSchema', () => {
  // 13. Required fields only
  test('passes with required fields only', () => {
    const result = createCommunicationLogSchema.safeParse(VALID_COMM_LOG_BASE);
    expect(result.success).toBe(true);
  });

  // 14. All optional fields
  test('passes with all optional fields provided', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      description: 'Said "mama" for the first time',
      wordsCount: 1,
      notes: 'Very excited moment',
    });
    expect(result.success).toBe(true);
  });

  // 15. Missing occurredAt
  test('rejects missing occurredAt', () => {
    const result = createCommunicationLogSchema.safeParse({
      childId: VALID_CHILD_ID,
      entryType: 'vocabulary',
    });
    expect(result.success).toBe(false);
  });

  // 16. Invalid entryType
  test('rejects invalid entryType', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      entryType: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  // 17. Negative wordsCount
  test('rejects negative wordsCount', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      wordsCount: -1,
    });
    expect(result.success).toBe(false);
  });

  // 18. Non-integer wordsCount
  test('rejects non-integer wordsCount', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      wordsCount: 3.5,
    });
    expect(result.success).toBe(false);
  });

  // 25. Missing childId
  test('rejects missing childId', () => {
    const result = createCommunicationLogSchema.safeParse({
      occurredAt: '2024-06-15T10:30:00.000Z',
      entryType: 'vocabulary',
    });
    expect(result.success).toBe(false);
  });

  test('passes with null description and wordsCount', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      description: null,
      wordsCount: null,
    });
    expect(result.success).toBe(true);
  });

  test('accepts zero wordsCount', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      wordsCount: 0,
    });
    expect(result.success).toBe(true);
  });

  test('passes with all valid entryType values', () => {
    const types = ['vocabulary', 'aac_usage', 'verbal_speech', 'signs', 'other'];
    for (const entryType of types) {
      const result = createCommunicationLogSchema.safeParse({ ...VALID_COMM_LOG_BASE, entryType });
      expect(result.success).toBe(true);
    }
  });

  test('rejects notes longer than 2000 chars', () => {
    const result = createCommunicationLogSchema.safeParse({
      ...VALID_COMM_LOG_BASE,
      notes: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCommunicationLogSchema
// ---------------------------------------------------------------------------

describe('updateCommunicationLogSchema', () => {
  // 19. All optional — empty object passes
  test('accepts empty object (all fields optional)', () => {
    const result = updateCommunicationLogSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 20. wordsCount null passes
  test('accepts wordsCount null', () => {
    const result = updateCommunicationLogSchema.safeParse({ wordsCount: null });
    expect(result.success).toBe(true);
  });

  test('accepts valid entryType update', () => {
    const result = updateCommunicationLogSchema.safeParse({ entryType: 'aac_usage' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listCommunicationLogFiltersSchema
// ---------------------------------------------------------------------------

describe('listCommunicationLogFiltersSchema', () => {
  // 21. Empty passes, defaults page=1 limit=20
  test('accepts empty object and defaults page to 1 and limit to 20', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  // 22. Page coercion from string "2"
  test('coerces string page "2" to number 2', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  // 23. Invalid entryType
  test('rejects invalid entryType', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({ entryType: 'bad_type' });
    expect(result.success).toBe(false);
  });

  test('accepts valid childId and entryType filters', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({
      childId: VALID_CHILD_ID,
      entryType: 'verbal_speech',
    });
    expect(result.success).toBe(true);
  });

  test('accepts from and to datetime filters', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });

  test('coerces string limit to number', () => {
    const result = listCommunicationLogFiltersSchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });
});
