/**
 * Unit tests for therapistValidation Zod schemas.
 *
 * Tests:
 *  1.  Valid therapist (name + specialty) passes createTherapistSchema
 *  2.  Name required — empty string fails
 *  3.  Name max 255 — 256 chars fails
 *  4.  Specialty must be valid TherapyType — 'yoga' fails
 *  5.  All 5 valid therapy types pass
 *  6.  Email format validated — 'not-an-email' fails
 *  7.  Valid email passes
 *  8.  Phone max 50 chars — 51 chars fails
 *  9.  Notes max 2000 chars — 2001 chars fails
 * 10.  Nullable phone/email/notes: null values accepted
 * 11.  updateTherapistSchema: all fields optional — empty object passes
 * 12.  updateTherapistSchema: invalid specialty still rejects
 */

import { createTherapistSchema, updateTherapistSchema } from '../therapistValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_BASE = { name: 'Dr. Silva', specialty: 'aba' } as const;

// ---------------------------------------------------------------------------
// createTherapistSchema
// ---------------------------------------------------------------------------

describe('createTherapistSchema', () => {
  // 1. Valid therapist passes
  test('valid therapist with name and specialty passes', () => {
    const result = createTherapistSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  // 2. Name required
  test('empty name fails', () => {
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, name: '' });
    expect(result.success).toBe(false);
  });

  // 3. Name max 255
  test('name longer than 255 chars fails', () => {
    const longName = 'a'.repeat(256);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, name: longName });
    expect(result.success).toBe(false);
  });

  test('name exactly 255 chars passes', () => {
    const name = 'a'.repeat(255);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, name });
    expect(result.success).toBe(true);
  });

  // 4. Specialty must be valid TherapyType
  test("specialty 'yoga' fails", () => {
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, specialty: 'yoga' });
    expect(result.success).toBe(false);
  });

  // 5. All 5 valid therapy types pass
  test.each(['aba', 'ot', 'fonoaudiologia', 'psicologia', 'fisioterapia'])(
    "specialty '%s' passes",
    (specialty) => {
      const result = createTherapistSchema.safeParse({ ...VALID_BASE, specialty });
      expect(result.success).toBe(true);
    },
  );

  // 6. Email format validated
  test("email 'not-an-email' fails", () => {
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  // 7. Valid email passes
  test('valid email passes', () => {
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, email: 'dr.silva@example.com' });
    expect(result.success).toBe(true);
  });

  // 8. Phone max 50 chars
  test('phone longer than 50 chars fails', () => {
    const phone = '1'.repeat(51);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, phone });
    expect(result.success).toBe(false);
  });

  test('phone exactly 50 chars passes', () => {
    const phone = '1'.repeat(50);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, phone });
    expect(result.success).toBe(true);
  });

  // 9. Notes max 2000 chars
  test('notes longer than 2000 chars fails', () => {
    const notes = 'x'.repeat(2001);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, notes });
    expect(result.success).toBe(false);
  });

  test('notes exactly 2000 chars passes', () => {
    const notes = 'x'.repeat(2000);
    const result = createTherapistSchema.safeParse({ ...VALID_BASE, notes });
    expect(result.success).toBe(true);
  });

  // 10. Nullable phone/email/notes
  test('null values for phone, email, notes are accepted', () => {
    const result = createTherapistSchema.safeParse({
      ...VALID_BASE,
      phone: null,
      email: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTherapistSchema
// ---------------------------------------------------------------------------

describe('updateTherapistSchema', () => {
  // 11. All fields optional — empty object passes
  test('empty object passes (all fields optional)', () => {
    const result = updateTherapistSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 12. Invalid specialty still rejects
  test("invalid specialty 'yoga' still fails", () => {
    const result = updateTherapistSchema.safeParse({ specialty: 'yoga' });
    expect(result.success).toBe(false);
  });

  test('partial update with only name passes', () => {
    const result = updateTherapistSchema.safeParse({ name: 'Dra. Costa' });
    expect(result.success).toBe(true);
  });

  test('partial update with only valid specialty passes', () => {
    const result = updateTherapistSchema.safeParse({ specialty: 'psicologia' });
    expect(result.success).toBe(true);
  });
});
