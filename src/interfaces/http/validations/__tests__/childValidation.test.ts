/**
 * Zod schema validation tests for child-related schemas.
 *
 * Tests:
 *  createChildSchema:
 *   1. Valid input passes
 *   2. Missing name fails
 *   3. Empty name fails
 *   4. Invalid birthDate format fails
 *   5. Valid birthDate passes
 *   6. Invalid gender fails
 *   7. Optional fields may be omitted
 *  16. Care-notes fields (sensoryTriggers/calmingStrategies/emergencyContact):
 *      valid, null, over-length rejection
 *
 *  updateChildSchema:
 *   - care-notes fields are independently partial/nullable (null clears)
 *
 *  profileQuerySchema:
 *   8. Default periodDays=30 when omitted
 *   9. Coerces string to number
 *  10. Rejects values > 365
 *  11. Rejects values < 1
 *
 *  timelineQuerySchema:
 *  12. Default page=1, limit=20 when omitted
 *  13. Coerces string page/limit
 *  14. Rejects limit > 50
 *  15. from/to are optional strings
 */

import { createChildSchema, updateChildSchema, profileQuerySchema, timelineQuerySchema } from '../childValidation';

// ---------------------------------------------------------------------------
// createChildSchema
// ---------------------------------------------------------------------------

describe('createChildSchema', () => {
  const valid = {
    name: 'Ana Beatriz',
    birthDate: '2018-03-15',
    gender: 'female',
  };

  // 1. Valid input passes
  test('accepts valid input', () => {
    const result = createChildSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  // 2. Missing name fails
  test('rejects missing name', () => {
    const { name: _n, ...rest } = valid;
    const result = createChildSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // 3. Empty name fails
  test('rejects empty name', () => {
    const result = createChildSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  // 4. Invalid birthDate format fails
  test('rejects invalid birthDate format', () => {
    const result = createChildSchema.safeParse({ ...valid, birthDate: '15/03/2018' });
    expect(result.success).toBe(false);
  });

  // 5. Valid birthDate passes
  test('accepts YYYY-MM-DD birthDate', () => {
    const result = createChildSchema.safeParse({ ...valid, birthDate: '2020-01-01' });
    expect(result.success).toBe(true);
  });

  // 6. Invalid gender fails
  test('rejects invalid gender value', () => {
    const result = createChildSchema.safeParse({ ...valid, gender: 'unknown' });
    expect(result.success).toBe(false);
  });

  // 7. Optional fields may be omitted
  test('accepts input without optional fields', () => {
    const result = createChildSchema.safeParse({ name: 'Pedro', birthDate: '2019-07-22' });
    expect(result.success).toBe(true);
  });

  // 16. Care-notes fields (sensoryTriggers/calmingStrategies/emergencyContact)
  test('accepts care-notes fields', () => {
    const result = createChildSchema.safeParse({
      ...valid,
      sensoryTriggers: 'Barulhos altos, luzes piscando',
      calmingStrategies: 'Abraço apertado, música calma',
      emergencyContact: 'Mãe: 11 99999-0000',
    });
    expect(result.success).toBe(true);
  });

  test('accepts null care-notes fields', () => {
    const result = createChildSchema.safeParse({
      ...valid,
      sensoryTriggers: null,
      calmingStrategies: null,
      emergencyContact: null,
    });
    expect(result.success).toBe(true);
  });

  test('rejects sensoryTriggers over 2000 chars', () => {
    const result = createChildSchema.safeParse({ ...valid, sensoryTriggers: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  test('rejects emergencyContact over 500 chars', () => {
    const result = createChildSchema.safeParse({ ...valid, emergencyContact: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateChildSchema — care-notes fields are independently nullable/partial
// ---------------------------------------------------------------------------

describe('updateChildSchema — care-notes fields', () => {
  test('partial update of only emergencyContact passes', () => {
    const result = updateChildSchema.safeParse({ emergencyContact: 'Pai: 11 98888-0000' });
    expect(result.success).toBe(true);
  });

  test('null clears calmingStrategies', () => {
    const result = updateChildSchema.safeParse({ calmingStrategies: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calmingStrategies).toBeNull();
    }
  });

  test('empty object passes (no-op)', () => {
    const result = updateChildSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// profileQuerySchema
// ---------------------------------------------------------------------------

describe('profileQuerySchema', () => {
  // 8. Default periodDays=30 when omitted
  test('defaults periodDays to 30 when omitted', () => {
    const result = profileQuerySchema.parse({});
    expect(result.periodDays).toBe(30);
  });

  // 9. Coerces string to number
  test('coerces string "90" to number 90', () => {
    const result = profileQuerySchema.parse({ periodDays: '90' });
    expect(result.periodDays).toBe(90);
  });

  // 10. Rejects values > 365
  test('rejects periodDays > 365', () => {
    const result = profileQuerySchema.safeParse({ periodDays: 400 });
    expect(result.success).toBe(false);
  });

  // 11. Rejects values < 1
  test('rejects periodDays < 1', () => {
    const result = profileQuerySchema.safeParse({ periodDays: 0 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// timelineQuerySchema
// ---------------------------------------------------------------------------

describe('timelineQuerySchema', () => {
  // 12. Default page=1, limit=20 when omitted
  test('defaults page=1 and limit=20 when omitted', () => {
    const result = timelineQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  // 13. Coerces string page/limit
  test('coerces string "2" and "10" to numbers', () => {
    const result = timelineQuerySchema.parse({ page: '2', limit: '10' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  // 14. Rejects limit > 50
  test('rejects limit > 50', () => {
    const result = timelineQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });

  // 15. from/to are optional strings
  test('accepts from and to as optional strings', () => {
    const result = timelineQuerySchema.parse({
      from: '2025-01-01T00:00:00.000Z',
      to: '2025-12-31T23:59:59.000Z',
    });
    expect(result.from).toBe('2025-01-01T00:00:00.000Z');
    expect(result.to).toBe('2025-12-31T23:59:59.000Z');
  });
});
