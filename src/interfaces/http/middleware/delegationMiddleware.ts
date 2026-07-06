import { Request, Response, NextFunction } from 'express';
import { CaregiverShareService } from '../../../application/services/CaregiverShareService';
import { AccessLogService } from '../../../application/services/AccessLogService';
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
      /**
       * The childId the caller delegated for (i.e. the literal value of the
       * X-Delegate-Child-Id header, once verified). Distinct from
       * effectiveUserId: this is what scopes delegation to ONE child even
       * when the owner has several — effectiveUserId alone would otherwise
       * let a caregiver granted access to child A read/write child B just by
       * putting B's id in a request, since every domain query is scoped by
       * user_id (the owner), not child_id.
       */
      delegatedChildId?: string;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractRequestedChildId(req: Request): string | undefined {
  const fromBody = req.body && typeof req.body.childId === 'string' ? req.body.childId : undefined;
  const fromQuery = typeof req.query.childId === 'string' ? req.query.childId : undefined;
  const fromParams = typeof req.params.childId === 'string' ? req.params.childId : undefined;
  return fromParams ?? fromBody ?? fromQuery;
}

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
 *
 * Scope enforcement: resolving effectiveUserId alone is not enough — an
 * owner can have several children, and every domain query is scoped by
 * user_id, not child_id. Without an extra check, a caregiver granted access
 * to child A could put child B's id (the same owner's other child) in the
 * request body/query/params and read or write B's data, which they were
 * never granted. This middleware rejects (403) any request whose explicit
 * `childId` (body, query, or :childId route param) does not match the
 * delegated one. Routes that reference "a child" via some other field name
 * (e.g. a resource's own :id) are not covered by this generic check and
 * need their own explicit guard — see ChildController for the one place
 * (`/api/children/:id`) where that applies today.
 *
 * Every delegated request (read or write) is also recorded to access_logs
 * under the caregiver's real userId (not the owner's), so the owner's audit
 * trail reflects who actually acted, not just whose data was touched.
 */
export function createDelegationMiddleware(
  caregiverShareService: CaregiverShareService,
  accessLogService: AccessLogService,
) {
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

      const requestedChildId = extractRequestedChildId(req);
      if (requestedChildId && requestedChildId !== childId) {
        return next(new AuthorizationError('Delegated access does not cover this child'));
      }

      req.effectiveUserId = ownerUserId;
      req.delegatedChildId = childId;

      const actorUserId = req.userId;
      res.on('finish', () => {
        if (res.statusCode >= 400) return; // don't log rejected/failed requests
        void accessLogService.record({
          actorUserId,
          childId,
          resourceType: `delegated:${req.method}:${req.baseUrl}${req.path}`,
          action: ['GET', 'HEAD'].includes(req.method) ? 'read' : 'write',
        });
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
