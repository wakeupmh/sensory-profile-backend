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

  /**
   * Esta era a única das 24 conversões com diferença real de comportamento: o
   * `toJSON` escrito à mão devolvia `createdAt` como string ISO, e o herdado
   * devolve a `Date`. Fica assim de propósito. `JSON.stringify` produz
   * exatamente os mesmos bytes a partir de uma `Date`, o método não é chamado
   * por ninguém (o controller responde `{subscribed:true}`), e forçar a
   * string exigiria um `toJSON` que contraria o tipo da base — trocar uma
   * diferença invisível por uma exceção ao contrato.
   */
  protected hiddenFields() {
    return ['id', 'userId', 'p256dhKey', 'authKey'] as const;
  }

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getEndpoint(): string { return this.props.endpoint; }
  getP256dhKey(): string { return this.props.p256dhKey; }
  getAuthKey(): string { return this.props.authKey; }

}
