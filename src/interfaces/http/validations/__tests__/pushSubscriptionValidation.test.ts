/**
 * Unit tests for pushSubscriptionValidation Zod schemas.
 *
 * createPushSubscriptionSchema tests:
 *  1. a valid PushSubscription.toJSON()-shaped payload passes
 *  2. missing endpoint fails
 *  3. non-URL endpoint fails
 *  4. missing keys.p256dh fails
 *  5. missing keys.auth fails
 *  6. empty-string key fails
 *
 * deletePushSubscriptionSchema tests:
 *  7. a valid { endpoint } payload passes
 *  8. missing endpoint fails
 */

import { createPushSubscriptionSchema, deletePushSubscriptionSchema } from '../pushSubscriptionValidation';

const VALID_SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'p256dh-key-value', auth: 'auth-key-value' },
};

describe('createPushSubscriptionSchema', () => {
  test('a valid PushSubscription.toJSON()-shaped payload passes', () => {
    const result = createPushSubscriptionSchema.safeParse(VALID_SUBSCRIPTION);
    expect(result.success).toBe(true);
  });

  test('missing endpoint fails', () => {
    const { endpoint, ...rest } = VALID_SUBSCRIPTION;
    void endpoint;
    const result = createPushSubscriptionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test('non-URL endpoint fails', () => {
    const result = createPushSubscriptionSchema.safeParse({ ...VALID_SUBSCRIPTION, endpoint: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  test('missing keys.p256dh fails', () => {
    const result = createPushSubscriptionSchema.safeParse({
      ...VALID_SUBSCRIPTION,
      keys: { auth: 'auth-key-value' },
    });
    expect(result.success).toBe(false);
  });

  test('missing keys.auth fails', () => {
    const result = createPushSubscriptionSchema.safeParse({
      ...VALID_SUBSCRIPTION,
      keys: { p256dh: 'p256dh-key-value' },
    });
    expect(result.success).toBe(false);
  });

  test('empty-string key fails', () => {
    const result = createPushSubscriptionSchema.safeParse({
      ...VALID_SUBSCRIPTION,
      keys: { p256dh: '', auth: 'auth-key-value' },
    });
    expect(result.success).toBe(false);
  });
});

describe('deletePushSubscriptionSchema', () => {
  test('a valid { endpoint } payload passes', () => {
    const result = deletePushSubscriptionSchema.safeParse({ endpoint: VALID_SUBSCRIPTION.endpoint });
    expect(result.success).toBe(true);
  });

  test('missing endpoint fails', () => {
    const result = deletePushSubscriptionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
