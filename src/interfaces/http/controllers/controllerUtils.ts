import { Request, Response } from 'express';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidId(id: string | undefined, entityName = 'ID'): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new ValidationError(`Invalid ${entityName} format`);
  }
}

export function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}
