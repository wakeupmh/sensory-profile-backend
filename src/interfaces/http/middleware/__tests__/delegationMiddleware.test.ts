/**
 * Unit tests for createDelegationMiddleware.
 *
 * The middleware is exercised directly against fake Express req/res/next —
 * no HTTP server or database needed. CaregiverShareService is mocked.
 *
 * Covers:
 *  1. no X-Delegate-Child-Id header — calls next() with no error, effectiveUserId untouched
 *  2. malformed header value — calls next(ValidationError), no service call
 *  3. missing req.userId (should not happen post-authMiddleware, but fail closed) — next(AuthorizationError)
 *  4. header present but caller has no relationship to the child — next(AuthorizationError), effectiveUserId untouched
 *  5. header present and caller owns/is an accepted caregiver of the child — sets req.effectiveUserId, calls next() with no error
 *  6. a resolution error from the service is forwarded to next(), not swallowed
 */

import { Request, Response, NextFunction } from 'express';
import { createDelegationMiddleware } from '../delegationMiddleware';
import type { CaregiverShareService } from '../../../../application/services/CaregiverShareService';
import { ValidationError, AuthorizationError } from '../../../../infrastructure/utils/errors/CustomErrors';

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const CALLER_ID = 'caller-001';
const OWNER_ID = 'owner-001';

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    header: jest.fn().mockReturnValue(undefined),
    userId: CALLER_ID,
    ...overrides,
  } as unknown as Request;
}

function makeService(resolveEffectiveOwner: jest.Mock): CaregiverShareService {
  return { resolveEffectiveOwner } as unknown as CaregiverShareService;
}

describe('createDelegationMiddleware', () => {
  test('no header — calls next() with no error and does not touch effectiveUserId', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq();
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect(req.effectiveUserId).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test('malformed header value is rejected without calling the service', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq({ header: jest.fn().mockReturnValue('not-a-uuid') });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  test('missing req.userId fails closed with AuthorizationError', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID), userId: undefined });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('caller with no relationship to the child fails closed with AuthorizationError', async () => {
    const resolve = jest.fn().mockResolvedValue(null);
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).toHaveBeenCalledWith(VALID_CHILD_ID, CALLER_ID);
    expect(req.effectiveUserId).toBeUndefined();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('verified relationship sets req.effectiveUserId and calls next() with no error', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(req.effectiveUserId).toBe(OWNER_ID);
    expect(next).toHaveBeenCalledWith();
  });

  test('a resolution error is forwarded to next(), not swallowed', async () => {
    const boom = new Error('db exploded');
    const resolve = jest.fn().mockRejectedValue(boom);
    const middleware = createDelegationMiddleware(makeService(resolve));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(req.effectiveUserId).toBeUndefined();
    expect((next as jest.Mock).mock.calls[0][0]).toBe(boom);
  });
});
