import type { ErrorEvent } from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import { scrubEvent } from '../sentry';
import { errorHandler } from '../../utils/errors/ErrorHandler';
import { NotFoundError } from '../../utils/errors/CustomErrors';

jest.mock('@sentry/node', () => ({
  ...jest.requireActual('@sentry/node'),
  captureException: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { captureException } = require('@sentry/node') as { captureException: jest.Mock };

describe('scrubEvent', () => {
  test('drops everything personal the request and user carry', () => {
    const event = {
      type: undefined,
      user: { id: 'user-1', email: 'mae@example.com', ip_address: '1.2.3.4' },
      request: {
        method: 'POST',
        url: 'https://api.example.com/api/children/abc?name=Ana',
        query_string: 'name=Ana',
        data: { name: 'Ana', diagnosis: 'TEA' },
        cookies: { sb: 'token' },
        headers: { cookie: 'sb=token', authorization: 'Bearer x', 'user-agent': 'UA' },
      },
      breadcrumbs: [{ message: 'Request started' }],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.request).toEqual({ method: 'POST', url: 'https://api.example.com/api/children/abc' });
    expect(JSON.stringify(scrubbed)).not.toMatch(/Ana|TEA|token|mae@/);
  });
});

describe('errorHandler error tracking', () => {
  function run(error: Error): number {
    let status = 0;
    const res = {
      status: (s: number) => {
        status = s;
        return res;
      },
      json: () => res,
    } as unknown as Response;
    const req = { method: 'GET', url: '/x', headers: { 'x-request-id': 'req-42' } } as unknown as Request;
    errorHandler(error, req, res, (() => {}) as NextFunction);
    return status;
  }

  beforeEach(() => captureException.mockClear());

  test('a 5xx is reported, tagged with the request id', () => {
    const error = new Error('db exploded');
    expect(run(error)).toBe(500);
    expect(captureException).toHaveBeenCalledWith(error, { tags: { requestId: 'req-42' } });
  });

  test('a 4xx is not reported', () => {
    expect(run(new NotFoundError('Criança'))).toBe(404);
    expect(captureException).not.toHaveBeenCalled();
  });
});
