import { Request, Response, NextFunction } from 'express';
import { CaregiverShareService } from '../../../application/services/CaregiverShareService';
import { AuthorizationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

declare global {
  namespace Express {
    interface Request {
      /**
       * Set only when the caller explicitly delegated via the
       * X-Delegate-Child-Id header and the delegation was verified. When
       * present, requireUserId(req) returns this instead of req.userId so
       * every existing controller transparently operates on the child
       * owner's data without being rewritten.
       */
      effectiveUserId?: string;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opt-in co-caregiver delegation. A caregiver who is NOT the literal owner
 * of a child (children.user_id) can act on that child's data by sending
 * `X-Delegate-Child-Id: <childId>` on the request. The header is resolved
 * against caregiver_shares; if the caller has no accepted relationship to
 * that child, the request is rejected outright (fail closed) rather than
 * silently falling back to the caller's own — likely empty — data, since
 * they explicitly asked to act on a specific child's behalf.
 *
 * Requests that never send the header are completely unaffected — this is
 * purely additive to the existing single-owner model.
 */
export function createDelegationMiddleware(caregiverShareService: CaregiverShareService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const childId = req.header('X-Delegate-Child-Id');
    if (!childId) return next();

    if (!UUID_REGEX.test(childId)) {
      return next(new ValidationError('Invalid X-Delegate-Child-Id format'));
    }
    if (!req.userId) return next(new AuthorizationError());

    try {
      const ownerUserId = await caregiverShareService.resolveEffectiveOwner(childId, req.userId);
      if (!ownerUserId) {
        return next(new AuthorizationError('No caregiver relationship to this child'));
      }
      req.effectiveUserId = ownerUserId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
