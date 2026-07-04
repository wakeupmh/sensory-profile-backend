import { z } from 'zod';

// Deliberately permissive but bounded — clinical documents come in many
// formats (PDF reports, JPEG/PNG photos, MP4 behavior clips, DOCX).
const ALLOWED_MIME_PREFIXES = ['application/pdf', 'image/', 'video/', 'application/msword', 'application/vnd.'];

const mimeTypeSchema = z
  .string()
  .max(150)
  .refine((val) => ALLOWED_MIME_PREFIXES.some((prefix) => val.startsWith(prefix)), {
    message: 'Tipo de arquivo não suportado',
  });

export const requestUploadSchema = z.object({
  childId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  mimeType: mimeTypeSchema,
  // ponytail: soft 50MB cap on the *declared* size only. The presigned PUT
  // URL does not carry a content-length-range condition (that needs a POST
  // policy, not a simple PUT presign), so S3 accepts a larger body. This
  // catches egregious client-side mistakes, not malicious uploads. Upgrade
  // path: switch to S3 POST-object presigned policies with content-length-range
  // if strict server-side enforcement is required.
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024).nullable().optional(),
  resourceType: z.string().max(50).nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const listDocumentFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
});
