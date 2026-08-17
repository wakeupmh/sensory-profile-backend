export interface PushSubscriptionProps {
  id: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  createdAt: Date;
}

export class PushSubscription {
  constructor(private readonly props: PushSubscriptionProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getEndpoint(): string { return this.props.endpoint; }
  getP256dhKey(): string { return this.props.p256dhKey; }
  getAuthKey(): string { return this.props.authKey; }

  toJSON() {
    return {
      endpoint: this.props.endpoint,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}
