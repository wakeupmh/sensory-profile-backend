import { z } from 'zod';

export const acceptConsentSchema = z.object({ version: z.string() });
