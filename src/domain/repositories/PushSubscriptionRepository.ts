import { PushSubscription } from '../entities/PushSubscription';

export interface PushSubscriptionRepository {
  /** Same endpoint re-subscribing (e.g. after the browser rotates keys) updates the existing row instead of erroring. */
  upsert(userId: string, endpoint: string, p256dhKey: string, authKey: string): Promise<PushSubscription>;
  /** Scoped to userId so a caller can only remove their own subscription. */
  deleteByEndpoint(userId: string, endpoint: string): Promise<void>;
  /** Used by the digest job to drop subscriptions the push service reports as gone (404/410), regardless of owner. */
  deleteById(id: string): Promise<void>;
  findAll(): Promise<PushSubscription[]>;
}
