import { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';
import { WebPushService } from '../../infrastructure/push/WebPushService';

export class PushSubscriptionService {
  constructor(
    private readonly repo: PushSubscriptionRepository,
    private readonly webPush: WebPushService,
  ) {}

  getPublicKey(): string {
    return this.webPush.getPublicKey();
  }

  subscribe(userId: string, endpoint: string, p256dhKey: string, authKey: string) {
    return this.repo.upsert(userId, endpoint, p256dhKey, authKey);
  }

  unsubscribe(userId: string, endpoint: string): Promise<void> {
    return this.repo.deleteByEndpoint(userId, endpoint);
  }
}
