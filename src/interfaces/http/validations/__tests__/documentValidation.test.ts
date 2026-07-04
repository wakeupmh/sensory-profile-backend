/**
 * Unit tests for document Zod validation schemas.
 *
 * Covers:
 *  1. requestUploadSchema — valid payload, bad mimeType, oversized title,
 *     oversized mimeType, oversized sizeBytes, non-uuid childId/resourceId
 *  2. updateDocumentSchema — partial updates, empty object, oversized title
 *  3. listDocumentFiltersSchema — defaults, invalid childId, invalid resourceId
 *
 * All tests work directly against the exported Zod schemas — no running
 * server needed.
 */

import {
  requestUploadSchema,
  updateDocumentSchema,
  listDocumentFiltersSchema,
} from '../documentValidation';

const VALID_CHILD_ID = '018f4e8a-1234-7abc-8def-0123456789ab';

function makeUploadPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    childId: VALID_CHILD_ID,
    title: 'Laudo neurológico',
    mimeType: 'application/pdf',
    ...overrides,
  };
}

describe('requestUploadSchema', () => {
  test('valid PDF payload passes', () => {
    const result = requestUploadSchema.safeParse(makeUploadPayload());
    expect(result.success).toBe(true);
  });

  test('valid image payload passes', () => {
    const result = requestUploadSchema.safeParse(makeUploadPayload({ mimeType: 'image/jpeg' }));
    expect(result.success).toBe(true);
  });

  test('valid video payload with sizeBytes passes', () => {
    const result = requestUploadSchema.safeParse(
      makeUploadPayload({ mimeType: 'video/mp4', sizeBytes: 5_000_000 }),
    );
    expect(result.success).toBe(true);
  });

  test('unsupported mimeType is rejected', () => {
    const result = requestUploadSchema.safeParse(makeUploadPayload({ mimeType: 'text/html' }));
    expect(result.success).toBe(false);
  });

  test('mimeType longer than 150 chars is rejected (matches VARCHAR(150))', () => {
    const result = requestUploadSchema.safeParse(
      makeUploadPayload({ mimeType: 'application/' + 'x'.repeat(140) }),
    );
    expect(result.success).toBe(false);
  });

  test('title longer than 255 chars is rejected', () => {
    const result = requestUploadSchema.safeParse(makeUploadPayload({ title: 'a'.repeat(256) }));
    expect(result.success).toBe(false);
  });

  test('sizeBytes over 50MB is rejected', () => {
    const result = requestUploadSchema.safeParse(
      makeUploadPayload({ sizeBytes: 50 * 1024 * 1024 + 1 }),
    );
    expect(result.success).toBe(false);
  });

  test('non-uuid childId is rejected', () => {
    const result = requestUploadSchema.safeParse(makeUploadPayload({ childId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  test('non-uuid resourceId is rejected', () => {
    const result = requestUploadSchema.safeParse(
      makeUploadPayload({ resourceId: 'not-a-uuid' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('updateDocumentSchema', () => {
  test('partial title update passes', () => {
    const result = updateDocumentSchema.safeParse({ title: 'Novo título' });
    expect(result.success).toBe(true);
  });

  test('partial description update passes', () => {
    const result = updateDocumentSchema.safeParse({ description: 'Atualizado' });
    expect(result.success).toBe(true);
  });

  test('null description passes', () => {
    const result = updateDocumentSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  test('empty object passes (no-op)', () => {
    const result = updateDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('title longer than 255 chars is rejected', () => {
    const result = updateDocumentSchema.safeParse({ title: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });
});

describe('listDocumentFiltersSchema', () => {
  test('empty filters pass', () => {
    const result = listDocumentFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('valid childId filter passes', () => {
    const result = listDocumentFiltersSchema.safeParse({ childId: VALID_CHILD_ID });
    expect(result.success).toBe(true);
  });

  test('invalid childId is rejected', () => {
    const result = listDocumentFiltersSchema.safeParse({ childId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('invalid resourceId is rejected', () => {
    const result = listDocumentFiltersSchema.safeParse({ resourceId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});