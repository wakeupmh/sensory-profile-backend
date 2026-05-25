import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { AuthenticationError } from '../../../infrastructure/utils/errors/CustomErrors';

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
    return next();
  } catch {
    return next(new AuthenticationError());
  }
};
