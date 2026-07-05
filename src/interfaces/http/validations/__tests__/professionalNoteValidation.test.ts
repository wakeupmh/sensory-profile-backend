/**
 * Unit tests for professional-note and access-log Zod validation schemas.
 *
 * Covers:
 *  1. createProfessionalNoteSchema — valid payload, empty content, oversized
 *     content, invalid resourceId, optional fields omitted
 *  2. updateProfessionalNoteSchema — valid content, empty content rejected
 *  3. listAccessLogsQuerySchema — defaults, coercion, limit max
 *
 * All tests work directly against the exported Zod schemas — no running
 * server needed.
 */

import {
  createProfessionalNoteSchema,
  updateProfessionalNoteSchema,
  listAccessLogsQuerySchema,
} from '../professionalNoteValidation';

const VALID_RESOURCE_ID = '018f4e8a-1234-7abc-8def-0123456789ab';

describe('createProfessionalNoteSchema', () => {
  test('valid minimal payload (content only) passes', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: 'Sessão produtiva hoje.' });
    expect(result.success).toBe(true);
  });

  test('valid payload with resourceType/resourceId passes', () => {
    const result = createProfessionalNoteSchema.safeParse({
      content: 'Observação sobre a sessão de hoje.',
      resourceType: 'therapy_session',
      resourceId: VALID_RESOURCE_ID,
    });
    expect(result.success).toBe(true);
  });

  test('empty content is rejected', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  test('whitespace-only content is rejected (trimmed then min-length checked)', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: '   ' });
    expect(result.success).toBe(false);
  });

  test('content longer than 4000 chars is rejected', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: 'x'.repeat(4001) });
    expect(result.success).toBe(false);
  });

  test('content exactly 4000 chars passes', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: 'x'.repeat(4000) });
    expect(result.success).toBe(true);
  });

  test('missing content is rejected', () => {
    const result = createProfessionalNoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('non-uuid resourceId is rejected', () => {
    const result = createProfessionalNoteSchema.safeParse({ content: 'nota', resourceId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('null resourceType/resourceId are accepted', () => {
    const result = createProfessionalNoteSchema.safeParse({
      content: 'nota',
      resourceType: null,
      resourceId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateProfessionalNoteSchema', () => {
  test('valid content passes', () => {
    const result = updateProfessionalNoteSchema.safeParse({ content: 'Nota corrigida.' });
    expect(result.success).toBe(true);
  });

  test('empty content is rejected', () => {
    const result = updateProfessionalNoteSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  test('missing content is rejected (content is required on update, unlike a partial patch)', () => {
    const result = updateProfessionalNoteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('listAccessLogsQuerySchema', () => {
  test('empty object yields page=1 and limit=50', () => {
    const result = listAccessLogsQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  test('page and limit are coerced from strings', () => {
    const result = listAccessLogsQuerySchema.parse({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  test('limit above 100 is rejected', () => {
    const result = listAccessLogsQuerySchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  test('limit of exactly 100 passes', () => {
    const result = listAccessLogsQuerySchema.safeParse({ limit: '100' });
    expect(result.success).toBe(true);
  });

  test('page below 1 is rejected', () => {
    const result = listAccessLogsQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });
});
