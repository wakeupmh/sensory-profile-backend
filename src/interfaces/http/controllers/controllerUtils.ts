import { Request, Response } from 'express';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

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
