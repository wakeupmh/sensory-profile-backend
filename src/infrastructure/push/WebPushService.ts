import webpush from 'web-push';
import { ServiceUnavailableError } from '../utils/errors/CustomErrors';

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Thrown when the push service reports the subscription as gone (404/410) — callers should delete the stored subscription. */
export class PushSubscriptionGoneError extends Error {
  constructor() {
    super('Push subscription is no longer valid');
    this.name = 'PushSubscriptionGoneError';
  }
}

/**
 * Thin wrapper around web-push (VAPID). Lazy config mirrors
 * EmailService/S3StorageService — missing VAPID env vars only fail the
 * specific call, not server boot.
 */
export class WebPushService {
  private configured = false;

  getPublicKey(): string {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      throw new ServiceUnavailableError(
        'Serviço de notificações push temporariamente indisponível (VAPID_PUBLIC_KEY não configurada)',
        'web-push',
      );
    }
    return publicKey;
  }

  private ensureConfigured(): void {
    if (this.configured) return;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new ServiceUnavailableError(
        'Serviço de notificações push temporariamente indisponível (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configuradas)',
        'web-push',
      );
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  async send(subscription: WebPushSubscriptionInput, payload: WebPushPayload): Promise<void> {
    this.ensureConfigured();
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        throw new PushSubscriptionGoneError();
      }
      throw new ServiceUnavailableError(
        'Falha ao enviar notificação push',
        'web-push',
        e instanceof Error ? e : new Error(String(e)),
      );
    }
  }
}
