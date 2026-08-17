import { z } from 'zod';

// Mirrors the browser's PushSubscription.toJSON() shape exactly, so the
// frontend can POST the object it gets back from pushManager.subscribe()
// without any reshaping.
export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});
