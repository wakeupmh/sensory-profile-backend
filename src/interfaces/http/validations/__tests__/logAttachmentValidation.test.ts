/**
 * Unit tests for requestAttachmentUploadSchema.
 *
 * Covers:
 *  1. valid image mimeTypes pass (jpeg, png, heic, webp)
 *  2. non-image mimeType is rejected
 *  3. sizeBytes within cap passes; omitted/null passes
 *  4. sizeBytes over 20MB is rejected
 */

import { requestAttachmentUploadSchema } from '../logAttachmentValidation';

describe('requestAttachmentUploadSchema', () => {
  test.each(['image/jpeg', 'image/png', 'image/heic', 'image/webp'])(
    'accepts mimeType %s',
    (mimeType) => {
      const result = requestAttachmentUploadSchema.safeParse({ mimeType });
      expect(result.success).toBe(true);
    },
  );

  test('rejects a non-image mimeType', () => {
    const result = requestAttachmentUploadSchema.safeParse({ mimeType: 'application/pdf' });
    expect(result.success).toBe(false);
  });

  test('rejects video mimeType (photos only)', () => {
    const result = requestAttachmentUploadSchema.safeParse({ mimeType: 'video/mp4' });
    expect(result.success).toBe(false);
  });

  test('sizeBytes within cap passes', () => {
    const result = requestAttachmentUploadSchema.safeParse({ mimeType: 'image/jpeg', sizeBytes: 5_000_000 });
    expect(result.success).toBe(true);
  });

  test('omitted sizeBytes passes', () => {
    const result = requestAttachmentUploadSchema.safeParse({ mimeType: 'image/jpeg' });
    expect(result.success).toBe(true);
  });

  test('null sizeBytes passes', () => {
    const result = requestAttachmentUploadSchema.safeParse({ mimeType: 'image/jpeg', sizeBytes: null });
    expect(result.success).toBe(true);
  });

  test('sizeBytes over 20MB is rejected', () => {
    const result = requestAttachmentUploadSchema.safeParse({
      mimeType: 'image/jpeg',
      sizeBytes: 20 * 1024 * 1024 + 1,
    });
    expect(result.success).toBe(false);
  });
});
