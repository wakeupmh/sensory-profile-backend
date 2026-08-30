import { Entity } from './Entity';

export interface PushSubscriptionProps {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  createdAt: Date;
}

export class PushSubscription extends Entity<PushSubscriptionProps, 'id' | 'userId' | 'p256dhKey' | 'authKey'> {

  protected hiddenFields() {
    return ['id', 'userId', 'p256dhKey', 'authKey'] as const;
  }

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getEndpoint(): string { return this.props.endpoint; }
  getP256dhKey(): string { return this.props.p256dhKey; }
  getAuthKey(): string { return this.props.authKey; }

}
