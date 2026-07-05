/**
 * Unit tests for consolidatedReportValidation Zod schemas.
 *
 * getSummaryQuerySchema tests:
 *  1.  valid UUID + default periodDays
 *  2.  valid UUID + explicit periodDays
 *  3.  invalid UUID fails
 *  4.  periodDays below minimum fails
 *  5.  periodDays above maximum fails
 *  6.  periodDays coerced from string
 *
 * createShareSchema tests:
 *  7.  valid childId + default expiresInDays
 *  8.  missing childId fails
 *  9.  expiresInDays below minimum fails
 * 10.  expiresInDays above maximum fails
 *
 * listSharesQuerySchema tests:
 * 11.  valid UUID passes
 * 12.  invalid UUID fails
 *
 * generateAISummarySchema tests:
 * 13.  valid childId + default periodDays
 * 14.  invalid childId fails
 */

import {
  getSummaryQuerySchema,
  createShareSchema,
  listSharesQuerySchema,
  generateAISummarySchema,
  consultationBriefSchema,
} from '../consolidatedReportValidation';

const VALID_UUID = '018f4e8a-1234-7000-8000-000000000001';

// ---------------------------------------------------------------------------
// getSummaryQuerySchema
// ---------------------------------------------------------------------------

describe('getSummaryQuerySchema', () => {
  // 1. valid UUID + default periodDays
  test('valid UUID with no periodDays uses default 90', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.childId).toBe(VALID_UUID);
      expect(result.data.periodDays).toBe(90);
    }
  });

  // 2. valid UUID + explicit periodDays
  test('valid UUID with explicit periodDays parses correctly', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: VALID_UUID, periodDays: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodDays).toBe(30);
    }
  });

  // 3. invalid UUID fails
  test('invalid UUID fails validation', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  // 4. periodDays below minimum fails
  test('periodDays below 7 fails', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: VALID_UUID, periodDays: 6 });
    expect(result.success).toBe(false);
  });

  // 5. periodDays above maximum fails
  test('periodDays above 365 fails', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: VALID_UUID, periodDays: 366 });
    expect(result.success).toBe(false);
  });

  // 6. periodDays coerced from string
  test('periodDays is coerced from string', () => {
    const result = getSummaryQuerySchema.safeParse({ childId: VALID_UUID, periodDays: '60' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodDays).toBe(60);
    }
  });
});

// ---------------------------------------------------------------------------
// createShareSchema
// ---------------------------------------------------------------------------

describe('createShareSchema', () => {
  // 7. valid childId + default expiresInDays
  test('valid childId with no expiresInDays uses default 30', () => {
    const result = createShareSchema.safeParse({ childId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.childId).toBe(VALID_UUID);
      expect(result.data.expiresInDays).toBe(30);
    }
  });

  // 8. missing childId fails
  test('missing childId fails', () => {
    const result = createShareSchema.safeParse({ expiresInDays: 14 });
    expect(result.success).toBe(false);
  });

  // 9. expiresInDays below minimum fails
  test('expiresInDays below 1 fails', () => {
    const result = createShareSchema.safeParse({ childId: VALID_UUID, expiresInDays: 0 });
    expect(result.success).toBe(false);
  });

  // 10. expiresInDays above maximum fails
  test('expiresInDays above 365 fails', () => {
    const result = createShareSchema.safeParse({ childId: VALID_UUID, expiresInDays: 366 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listSharesQuerySchema
// ---------------------------------------------------------------------------

describe('listSharesQuerySchema', () => {
  // 11. valid UUID passes
  test('valid UUID passes', () => {
    const result = listSharesQuerySchema.safeParse({ childId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.childId).toBe(VALID_UUID);
    }
  });

  // 12. invalid UUID fails
  test('invalid UUID fails', () => {
    const result = listSharesQuerySchema.safeParse({ childId: 'bad-uuid' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateAISummarySchema
// ---------------------------------------------------------------------------

describe('generateAISummarySchema', () => {
  // 13. valid childId + default periodDays
  test('valid childId with no periodDays uses default 90', () => {
    const result = generateAISummarySchema.safeParse({ childId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.childId).toBe(VALID_UUID);
      expect(result.data.periodDays).toBe(90);
    }
  });

  // 14. invalid childId fails
  test('invalid childId fails', () => {
    const result = generateAISummarySchema.safeParse({ childId: 'not-uuid', periodDays: 30 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// consultationBriefSchema
// ---------------------------------------------------------------------------

describe('consultationBriefSchema', () => {
  test('valid childId with no periodDays uses default 60 (shorter than the 90-day quarterly summary)', () => {
    const result = consultationBriefSchema.safeParse({ childId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodDays).toBe(60);
    }
  });

  test('valid childId with explicit periodDays parses correctly', () => {
    const result = consultationBriefSchema.safeParse({ childId: VALID_UUID, periodDays: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodDays).toBe(30);
    }
  });

  test('invalid childId fails', () => {
    const result = consultationBriefSchema.safeParse({ childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('periodDays below 7 fails', () => {
    const result = consultationBriefSchema.safeParse({ childId: VALID_UUID, periodDays: 6 });
    expect(result.success).toBe(false);
  });

  test('periodDays above 365 fails', () => {
    const result = consultationBriefSchema.safeParse({ childId: VALID_UUID, periodDays: 366 });
    expect(result.success).toBe(false);
  });
});
