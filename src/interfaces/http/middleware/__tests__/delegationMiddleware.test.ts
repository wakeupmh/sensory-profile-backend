/**
 * Unit tests for createDelegationMiddleware.
 *
 * The middleware is exercised directly against fake Express req/res/next —
 * no HTTP server or database needed. CaregiverShareService and
 * AccessLogService are mocked.
 *
 * Covers:
 *  1. no X-Delegate-Child-Id header — calls next() with no error, effectiveUserId untouched
 *  2. malformed header value — calls next(ValidationError), no service call
 *  3. missing req.userId (should not happen post-authMiddleware, but fail closed) — next(AuthorizationError)
 *  4. header present but caller has no relationship to the child — next(AuthorizationError), effectiveUserId untouched
 *  5. header present and caller owns/is an accepted caregiver of the child — sets req.effectiveUserId/delegatedChildId, calls next() with no error
 *  6. a resolution error from the service is forwarded to next(), not swallowed
 *  7. requested childId (body/query/params) mismatching the delegated one is rejected with AuthorizationError
 *  8. requested childId matching the delegated one is allowed
 *  9. a successful delegated request is recorded to the access log under the caller's (actor's) userId
 *  10. a failed (>=400) delegated request is NOT recorded to the access log
 */

import { Request, Response, NextFunction } from 'express';
import { createDelegationMiddleware } from '../delegationMiddleware';
import type { CaregiverShareService } from '../../../../application/services/CaregiverShareService';
import type { AccessLogService } from '../../../../application/services/AccessLogService';
import { ValidationError, AuthorizationError } from '../../../../infrastructure/utils/errors/CustomErrors';

const VALID_CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const CALLER_ID = 'caller-001';
const OWNER_ID = 'owner-001';

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    header: jest.fn().mockReturnValue(undefined),
    userId: CALLER_ID,
    method: 'GET',
    baseUrl: '/api/children',
    path: '/',
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    statusCode: 200,
    on: jest.fn(),
  } as unknown as Response;
}

function fireFinish(res: Response): void {
  const onMock = res.on as jest.Mock;
  const call = onMock.mock.calls.find((c) => c[0] === 'finish');
  call?.[1]();
}

function makeService(resolveEffectiveOwner: jest.Mock): CaregiverShareService {
  return { resolveEffectiveOwner } as unknown as CaregiverShareService;
}

function makeAccessLogService(record: jest.Mock = jest.fn()): AccessLogService {
  return { record } as unknown as AccessLogService;
}

describe('createDelegationMiddleware', () => {
  test('no header — calls next() with no error and does not touch effectiveUserId', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq();
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect(req.effectiveUserId).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test('malformed header value is rejected without calling the service', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({ header: jest.fn().mockReturnValue('not-a-uuid') });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  test('missing req.userId fails closed with AuthorizationError', async () => {
    const resolve = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID), userId: undefined });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).not.toHaveBeenCalled();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('caller with no relationship to the child fails closed with AuthorizationError', async () => {
    const resolve = jest.fn().mockResolvedValue(null);
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(resolve).toHaveBeenCalledWith(VALID_CHILD_ID, CALLER_ID);
    expect(req.effectiveUserId).toBeUndefined();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('verified relationship sets req.effectiveUserId/delegatedChildId and calls next() with no error', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, makeRes(), next);

    expect(req.effectiveUserId).toBe(OWNER_ID);
    expect(req.delegatedChildId).toBe(VALID_CHILD_ID);
    expect(next).toHaveBeenCalledWith();
  });

  test('a resolution error is forwarded to next(), not swallowed', async () => {
    const boom = new Error('db exploded');
    const resolve = jest.fn().mockRejectedValue(boom);
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, {} as Response, next);

    expect(req.effectiveUserId).toBeUndefined();
    expect((next as jest.Mock).mock.calls[0][0]).toBe(boom);
  });

  test('requested childId (params) mismatching the delegated one is rejected', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const record = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService(record));
    const req = makeReq({
      header: jest.fn().mockReturnValue(VALID_CHILD_ID),
      params: { childId: OTHER_CHILD_ID },
    });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, makeRes(), next);

    expect(req.effectiveUserId).toBeUndefined();
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
    expect(record).not.toHaveBeenCalled();
  });

  test('requested childId (body) mismatching the delegated one is rejected', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({
      header: jest.fn().mockReturnValue(VALID_CHILD_ID),
      body: { childId: OTHER_CHILD_ID },
    });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, makeRes(), next);

    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('requested childId matching the delegated one is allowed', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService());
    const req = makeReq({
      header: jest.fn().mockReturnValue(VALID_CHILD_ID),
      params: { childId: VALID_CHILD_ID },
    });
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, makeRes(), next);

    expect(req.effectiveUserId).toBe(OWNER_ID);
    expect(next).toHaveBeenCalledWith();
  });

  test('a successful delegated request is recorded to the access log under the caller userId', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const record = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService(record));
    const req = makeReq({
      header: jest.fn().mockReturnValue(VALID_CHILD_ID),
      method: 'POST',
      baseUrl: '/api/children',
      path: `/${VALID_CHILD_ID}/notes`,
    });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, res, next);
    fireFinish(res);

    expect(record).toHaveBeenCalledWith({
      actorUserId: CALLER_ID,
      childId: VALID_CHILD_ID,
      resourceType: `delegated:POST:/api/children/${VALID_CHILD_ID}/notes`,
      action: 'write',
    });
  });

  test('a GET delegated request is recorded with action "read"', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const record = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService(record));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, res, next);
    fireFinish(res);

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'read' }));
  });

  test('a failed (>=400) delegated request is NOT recorded to the access log', async () => {
    const resolve = jest.fn().mockResolvedValue(OWNER_ID);
    const record = jest.fn();
    const middleware = createDelegationMiddleware(makeService(resolve), makeAccessLogService(record));
    const req = makeReq({ header: jest.fn().mockReturnValue(VALID_CHILD_ID) });
    const res = makeRes();
    (res as { statusCode: number }).statusCode = 404;
    const next = jest.fn() as unknown as NextFunction;

    await middleware(req, res, next);
    fireFinish(res);

    expect(record).not.toHaveBeenCalled();
  });
});
