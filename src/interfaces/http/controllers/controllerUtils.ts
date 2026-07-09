import { Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthenticationError, AuthorizationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidId(id: string | undefined, entityName = 'ID'): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new ValidationError(`Invalid ${entityName} format`);
  }
}

/**
 * Returns req.effectiveUserId when the caller delegated via
 * X-Delegate-Child-Id (see delegationMiddleware) and it was verified against
 * caregiver_shares, otherwise the caller's own userId. Every controller
 * calls this instead of reading req.userId directly, so caregiver
 * delegation works transparently across the whole app without each
 * controller needing to know about it.
 */
export function requireUserId(req: Request): string {
  if (req.effectiveUserId) return req.effectiveUserId;
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

/**
 * Delegation-scope guard for routes where the child id is the route's own
 * `:id` (e.g. /api/children/:id), not `:childId`. delegationMiddleware's
 * generic check only compares against a literal `childId` field, so it
 * cannot catch a caregiver delegated to child A requesting
 * `/api/children/<B>` — this closes that one remaining gap explicitly.
 * No-op when the request wasn't delegated.
 */
export function assertDelegatedChildMatches(req: Request, id: string): void {
  if (req.delegatedChildId && req.delegatedChildId !== id) {
    throw new AuthorizationError('Delegated access does not cover this child');
  }
}

/**
 * Constant-time comparison for shared-secret-gated system endpoints (cron
 * jobs — see ReminderDigestController/RetentionCleanupController). A plain
 * `!==` comparison short-circuits at the first mismatched byte, leaking how
 * many leading characters of a guess were correct through response timing;
 * timingSafeEqual takes the same time regardless. Requires equal-length
 * buffers, so a length mismatch (the common case — an attacker's guess is
 * essentially never the exact right length) is checked first and rejected
 * without calling it.
 */
export function verifyCronSecret(req: Request, headerName: string): void {
  const expected = process.env.CRON_SECRET;
  const provided = req.header(headerName);
  if (!expected || !provided) {
    throw new AuthenticationError('Invalid or missing cron secret');
  }
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw new AuthenticationError('Invalid or missing cron secret');
  }
}
