import { z } from 'zod';

const trimmedString = (max: number) =>
  z.string().trim().min(1, 'Cannot be empty').max(max, `Must not exceed ${max} characters`);

export const createProfessionalSchema = z.object({
  name: trimmedString(120),
  email: z.string().trim().email('Invalid email').max(254).optional(),
  profession: trimmedString(120).optional(),
});

export const updateProfessionalSchema = z.object({
  name: trimmedString(120),
  email: z.string().trim().email('Invalid email').max(254).nullable().optional(),
  profession: trimmedString(120).nullable().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,128}$/, 'Invalid invitation token format'),
});

// Match UUIDv7 (which zod's .uuid() rejects on some versions because the
// version nibble is "7"). Aligns with the relaxed path-param regex used by
// the shared controllerUtils.
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const shareGrantBodySchema = z.object({
  professionalId: z.string().regex(uuidRegex, 'Invalid professional ID format'),
});

export type CreateProfessionalPayload = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalPayload = z.infer<typeof updateProfessionalSchema>;
export type AcceptInvitationPayload = z.infer<typeof acceptInvitationSchema>;
export type ShareGrantPayload = z.infer<typeof shareGrantBodySchema>;
