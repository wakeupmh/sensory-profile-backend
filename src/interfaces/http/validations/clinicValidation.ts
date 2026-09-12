import { z } from 'zod';
import { CLINIC_ROLES } from '../../../domain/entities/ClinicMember';

export const createClinicSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const inviteClinicMemberSchema = z.object({
  memberName: z.string().trim().min(1).max(120),
  role: z.enum(CLINIC_ROLES),
});

export const acceptClinicInvitationSchema = z.object({
  token: z.string().min(10).max(200),
});
