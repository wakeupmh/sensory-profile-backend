/**
 * Unit tests for assertDelegatedChildMatches.
 *
 * Covers:
 *  1. non-delegated request (no req.delegatedChildId) — no-op regardless of id
 *  2. delegated request where id matches req.delegatedChildId — no-op
 *  3. delegated request where id does NOT match req.delegatedChildId — throws AuthorizationError
 */

import { Request } from 'express';
import { assertDelegatedChildMatches } from '../controllerUtils';
import { AuthorizationError } from '../../../../infrastructure/utils/errors/CustomErrors';

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
