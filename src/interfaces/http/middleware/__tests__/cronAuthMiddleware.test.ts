/**
 * Unit tests for cronAuthMiddleware.
 *
 * Covers:
 *  1. correct secret — calls next() with no error
 *  2. missing X-Cron-Secret header — AuthenticationError
 *  3. CRON_SECRET not configured on the server — AuthenticationError (fails
 *     closed; an unset env var must not mean "let everyone in")
 *  4. wrong secret, same length — AuthenticationError (the timingSafeEqual path)
 *  5. wrong secret, different length — AuthenticationError without letting
 *     timingSafeEqual throw on mismatched buffer lengths
 */

import { Request, Response, NextFunction } from 'express';
import { cronAuthMiddleware } from '../cronAuthMiddleware';
import { AuthenticationError } from '../../../../infrastructure/utils/errors/CustomErrors';

function makeReq(headerValue?: string): Request {
  return {
    header: (name: string) => (name === 'X-Cron-Secret' ? headerValue : undefined),
  } as unknown as Request;
}

function run(headerValue?: string): unknown {
  let captured: unknown = 'NOT_CALLED';
  const next: NextFunction = ((err?: unknown) => {
    captured = err;
  }) as NextFunction;
  cronAuthMiddleware(makeReq(headerValue), {} as Response, next);
  return captured;
}

describe('cronAuthMiddleware', () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  test('accepts the correct secret', () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(run('correct-horse-battery-staple')).toBeUndefined();
  });

  test('rejects a missing header', () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(run(undefined)).toBeInstanceOf(AuthenticationError);
  });

  test('rejects when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(run('anything')).toBeInstanceOf(AuthenticationError);
  });

  test('rejects a wrong secret of the same length', () => {
    process.env.CRON_SECRET = 'aaaaaaaaaa';
    expect(run('bbbbbbbbbb')).toBeInstanceOf(AuthenticationError);
  });

  test('rejects a wrong secret of a different length', () => {
    process.env.CRON_SECRET = 'a-long-correct-secret';
    expect(run('short')).toBeInstanceOf(AuthenticationError);
  });
});
