import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthenticationError } from '../../../infrastructure/utils/errors/CustomErrors';

const CRON_SECRET_HEADER = 'X-Cron-Secret';

/**
 * Authentication for the `/api/system/*` endpoints, which are triggered by an
 * external scheduler (GitHub Actions) rather than a logged-in user, so there
 * is no JWT to verify — a shared secret stands in for the session.
 *
 * This is middleware, not a helper called inside each controller, so that a
 * router's auth posture is visible at its mount point like every other router
 * in the app. When the check lived in the controller body, `reminderDigest`
 * and `retentionCleanup` were the only routers in the codebase mounting no
 * auth middleware at all, each carrying a comment explaining that this wasn't
 * a hole — which is exactly what someone skimming route files for
 * unauthenticated endpoints would misread.
 *
 * The comparison is constant-time: `!==` short-circuits on the first
 * mismatched byte, which leaks through response timing how much of a guess
 * was right. timingSafeEqual requires equal lengths, so a length mismatch —
 * the common case, since a guess is essentially never the exact right
 * length — is rejected first.
 */
export function cronAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.CRON_SECRET;
  const provided = req.header(CRON_SECRET_HEADER);

  if (!expected || !provided) {
    return next(new AuthenticationError('Invalid or missing cron secret'));
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return next(new AuthenticationError('Invalid or missing cron secret'));
  }

  return next();
}
