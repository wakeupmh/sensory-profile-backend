import { z } from 'zod';

const mimeTypeSchema = z
  .string()
  .max(150)
  .refine((val) => val.startsWith('image/'), {
    message: 'Apenas imagens são suportadas como anexo',
  });

export const requestAttachmentUploadSchema = z.object({
  mimeType: mimeTypeSchema,
  // Soft cap on the *declared* size only — same caveat as documentValidation's
  // sizeBytes (the presigned PUT URL has no server-side content-length
  // enforcement). Phone photos are typically 3-8MB; 20MB covers that with
  // headroom without accepting arbitrarily large uploads.
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024).nullable().optional(),
});
