import { z } from 'zod';
import { CHILD_SHARE_SCOPES } from '../../../domain/entities/ChildShare';

export const childShareScopeEnum = z.enum(CHILD_SHARE_SCOPES);

export const grantChildShareSchema = z.object({
  professionalId: z.string().uuid(),
  scopes: z.array(childShareScopeEnum).min(1, 'Selecione ao menos um escopo').max(CHILD_SHARE_SCOPES.length),
});
