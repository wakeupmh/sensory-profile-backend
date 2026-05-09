import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { AuthenticationError } from '../../../infrastructure/utils/errors/CustomErrors';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError());
  }

  const token = authHeader.slice(7);
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return next(new Error('SUPABASE_JWT_SECRET not set'));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.sub) {
      return next(new AuthenticationError());
    }
    req.userId = payload.sub;
    return next();
  } catch {
    return next(new AuthenticationError());
  }
};
