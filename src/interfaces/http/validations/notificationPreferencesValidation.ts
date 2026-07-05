import { z } from 'zod';

export const updateNotificationPreferencesSchema = z.object({
  reminderEmailsEnabled: z.boolean(),
});
