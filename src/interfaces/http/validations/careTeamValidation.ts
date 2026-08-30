import { z } from 'zod';
import { CARE_TEAM_ROLES } from '../../../domain/entities/CareTeamMember';

export const inviteCareTeamMemberSchema = z.object({
  memberName: z.string().trim().min(1, 'Nome obrigatório').max(120),
  // A mesma lista do CHECK da migration 035. Recusar aqui devolve um 400 com o
  // campo nomeado, em vez do 400 genérico que a violação do CHECK produziria.
  role: z.enum(CARE_TEAM_ROLES, {
    errorMap: () => ({ message: 'Especialidade inválida' }),
  }),
});

export const acceptCareTeamInvitationSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/, 'Token de convite inválido'),
});
