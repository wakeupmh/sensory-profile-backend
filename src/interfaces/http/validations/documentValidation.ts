import { z } from 'zod';

// Deliberately permissive but bounded — clinical documents come in many
// formats (PDF reports, JPEG/PNG photos, MP4 behavior clips, DOCX).
const ALLOWED_MIME_PREFIXES = ['application/pdf', 'image/', 'video/', 'application/msword', 'application/vnd.'];

/**
 * SVG passa pelo prefixo `image/` mas não é uma imagem inerte: pode conter
 * script, e o arquivo é servido depois por uma URL pré-assinada do S3. Abrir
 * essa URL executaria o script na origem do bucket — não na origem do app,
 * então não alcança a sessão do usuário, mas é uma superfície de phishing num
 * domínio que o próprio app entrega. Nenhum documento clínico precisa de SVG.
 */
const BLOCKED_MIME_TYPES = ['image/svg+xml', 'image/svg'];

const mimeTypeSchema = z
  .string()
  .max(150)
  .refine((val) => !BLOCKED_MIME_TYPES.includes(val.split(';')[0].trim().toLowerCase()), {
    message: 'Tipo de arquivo não suportado',
  })
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
  expiresAt: z.string().date().nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  expiresAt: z.string().date().nullable().optional(),
});

export const listDocumentFiltersSchema = z.object({
  childId: z.string().uuid().optional(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
});
