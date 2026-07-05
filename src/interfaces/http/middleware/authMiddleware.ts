import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { AuthenticationError } from '../../../infrastructure/utils/errors/CustomErrors';
import { PgUserProfileRepository } from '../../../infrastructure/repositories/PgUserProfileRepository';
import logger from '../../../infrastructure/utils/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL not set');

const JWKS = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
);

// There is no local "users" table — auth lives entirely in Supabase and no
// service-role Supabase Admin API credentials are configured. This is the
// only place the app ever sees a user's email, so it's captured here,
// best-effort and non-blocking, so reminder digests (and any future
// email-based feature) have somewhere to send to. A user's email becomes
// known to us the first time they make an authenticated request after this
// was added, not necessarily immediately.
const userProfileRepository = new PgUserProfileRepository();

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError());
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: 'authenticated',
      issuer: `${supabaseUrl}/auth/v1`,
      clockTolerance: 15,
    });
    if (!payload.sub) {
      return next(new AuthenticationError());
    }
    req.userId = payload.sub;

    if (typeof payload.email === 'string') {
      userProfileRepository.upsertEmail(payload.sub, payload.email).catch((error) => {
        logger.warn('[authMiddleware] failed to upsert user profile email', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return next();
  } catch {
    return next(new AuthenticationError());
  }
};
