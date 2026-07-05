import { z } from 'zod';

export const inviteCaregiverSchema = z.object({
  caregiverName: z.string().trim().min(1, 'Nome obrigatório').max(120),
});

export const acceptCaregiverInvitationSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/, 'Token de convite inválido'),
});
