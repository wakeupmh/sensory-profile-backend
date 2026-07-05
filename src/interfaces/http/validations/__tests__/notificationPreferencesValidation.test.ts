/**
 * Unit tests for notificationPreferencesValidation Zod schemas.
 *
 * updateNotificationPreferencesSchema tests:
 *  1. valid true passes
 *  2. valid false passes
 *  3. missing field fails
 *  4. non-boolean value fails
 */

import { updateNotificationPreferencesSchema } from '../notificationPreferencesValidation';

describe('updateNotificationPreferencesSchema', () => {
  test('reminderEmailsEnabled: true passes', () => {
    const result = updateNotificationPreferencesSchema.safeParse({ reminderEmailsEnabled: true });
    expect(result.success).toBe(true);
  });

  test('reminderEmailsEnabled: false passes', () => {
    const result = updateNotificationPreferencesSchema.safeParse({ reminderEmailsEnabled: false });
    expect(result.success).toBe(true);
  });

  test('missing reminderEmailsEnabled fails', () => {
    const result = updateNotificationPreferencesSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('non-boolean value fails', () => {
    const result = updateNotificationPreferencesSchema.safeParse({ reminderEmailsEnabled: 'yes' });
    expect(result.success).toBe(false);
  });
});
