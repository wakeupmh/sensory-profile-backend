import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';

/**
 * Error tracking, off until SENTRY_DSN is set. This backend stores children's
 * health data (LGPD Art. 11 and 14), so an event carries only the stack, the
 * method and the path: no body, cookies, headers, query string, user or
 * breadcrumbs (which would hold log lines).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { request } = event;
  return {
    ...event,
    user: undefined,
    breadcrumbs: undefined,
    request: request && { method: request.method, url: request.url?.split('?')[0] },
  };
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
}
