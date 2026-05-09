import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../../../infrastructure/utils/errors/CustomErrors';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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
    const payload = jwt.verify(token, secret) as { sub?: string };
    if (!payload.sub) {
      return next(new AuthenticationError());
    }
    req.userId = payload.sub;
    return next();
  } catch {
    return next(new AuthenticationError());
  }
};
