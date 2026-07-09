/**
 * Unit tests for assertDelegatedChildMatches and verifyCronSecret.
 *
 * Covers:
 *  1. non-delegated request (no req.delegatedChildId) — no-op regardless of id
 *  2. delegated request where id matches req.delegatedChildId — no-op
 *  3. delegated request where id does NOT match req.delegatedChildId — throws AuthorizationError
 *  4. verifyCronSecret: correct secret — no-op
 *  5. verifyCronSecret: missing header — throws AuthenticationError
 *  6. verifyCronSecret: CRON_SECRET env var not configured — throws AuthenticationError
 *  7. verifyCronSecret: wrong secret (same length) — throws AuthenticationError
 *  8. verifyCronSecret: wrong secret (different length) — throws AuthenticationError, doesn't call timingSafeEqual with mismatched buffers
 */

import { Request } from 'express';
import { assertDelegatedChildMatches, verifyCronSecret } from '../controllerUtils';
import { AuthenticationError, AuthorizationError } from '../../../../infrastructure/utils/errors/CustomErrors';

const CHILD_A = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const CHILD_B = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';

function makeReq(delegatedChildId?: string): Request {
  return { delegatedChildId } as unknown as Request;
}

describe('assertDelegatedChildMatches', () => {
  test('non-delegated request is a no-op', () => {
    const req = makeReq(undefined);
    expect(() => assertDelegatedChildMatches(req, CHILD_B)).not.toThrow();
  });

  test('delegated request matching the requested id is a no-op', () => {
    const req = makeReq(CHILD_A);
    expect(() => assertDelegatedChildMatches(req, CHILD_A)).not.toThrow();
  });

  test('delegated request for a different child throws AuthorizationError', () => {
    const req = makeReq(CHILD_A);
    expect(() => assertDelegatedChildMatches(req, CHILD_B)).toThrow(AuthorizationError);
  });
});

describe('verifyCronSecret', () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  function makeCronReq(headerValue?: string): Request {
    return { header: (name: string) => (name === 'X-Cron-Secret' ? headerValue : undefined) } as unknown as Request;
  }

  test('accepts the correct secret', () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    const req = makeCronReq('correct-horse-battery-staple');
    expect(() => verifyCronSecret(req, 'X-Cron-Secret')).not.toThrow();
  });

  test('rejects a missing header', () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    const req = makeCronReq(undefined);
    expect(() => verifyCronSecret(req, 'X-Cron-Secret')).toThrow(AuthenticationError);
  });

  test('rejects when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    const req = makeCronReq('anything');
    expect(() => verifyCronSecret(req, 'X-Cron-Secret')).toThrow(AuthenticationError);
  });

  test('rejects a wrong secret of the same length', () => {
    process.env.CRON_SECRET = 'aaaaaaaaaa';
    const req = makeCronReq('bbbbbbbbbb');
    expect(() => verifyCronSecret(req, 'X-Cron-Secret')).toThrow(AuthenticationError);
  });

  test('rejects a wrong secret of a different length', () => {
    process.env.CRON_SECRET = 'a-long-correct-secret';
    const req = makeCronReq('short');
    expect(() => verifyCronSecret(req, 'X-Cron-Secret')).toThrow(AuthenticationError);
  });
});
