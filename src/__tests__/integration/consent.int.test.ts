/**
 * Consent for processing a child's health data (LGPD Art. 11 and 14), through
 * the real account router and a real database. Only the Supabase JWT check is
 * stubbed: the test names the caller in a header.
 */
import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from 'infrastructure/database/connection';
import { errorHandler } from 'infrastructure/utils/errors/ErrorHandler';
import { AccountErasureService } from 'application/services/AccountErasureService';
import type { S3StorageService } from 'infrastructure/storage/S3StorageService';

jest.mock('../../interfaces/http/middleware/authMiddleware', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = req.header('X-Test-User');
    next();
  },
}));

import accountRoutes from '../../interfaces/http/routes/accountRoutes';

const CURRENT = '2026-11-23';
const app = express();
app.use(express.json());
app.use('/api/account', accountRoutes);
app.use(errorHandler);

const user = 'consent-' + randomUUID();
const as = (r: request.Test) => r.set('X-Test-User', user);

afterAll(async () => {
  await pool.query('DELETE FROM consents WHERE user_id = $1', [user]);
  await pool.end();
});

test('before accepting, nothing is accepted', async () => {
  const res = await as(request(app).get('/api/account/consent'));
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    success: true,
    data: { currentVersion: CURRENT, acceptedVersion: null, acceptedAt: null },
  });
});

test('a version other than the current one is refused', async () => {
  const res = await as(request(app).post('/api/account/consent').send({ version: '2020-01-01' }));
  expect(res.status).toBe(400);
  const missing = await as(request(app).post('/api/account/consent').send({}));
  expect(missing.status).toBe(400);
});

let firstAcceptedAt: string;

test('accepting the current version records it', async () => {
  const res = await as(request(app).post('/api/account/consent').send({ version: CURRENT }));
  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toEqual({
    currentVersion: CURRENT,
    acceptedVersion: CURRENT,
    acceptedAt: expect.any(String),
  });
  firstAcceptedAt = res.body.data.acceptedAt;
  expect(Number.isNaN(Date.parse(firstAcceptedAt))).toBe(false);
});

test('after accepting, GET reports the acceptance', async () => {
  const res = await as(request(app).get('/api/account/consent'));
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ currentVersion: CURRENT, acceptedVersion: CURRENT, acceptedAt: firstAcceptedAt });
});

test('accepting twice returns the same record', async () => {
  const res = await as(request(app).post('/api/account/consent').send({ version: CURRENT }));
  expect(res.status).toBe(201);
  expect(res.body.data).toEqual({ currentVersion: CURRENT, acceptedVersion: CURRENT, acceptedAt: firstAcceptedAt });
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM consents WHERE user_id = $1', [user]);
  expect(rows[0].n).toBe(1);
});

test('erasing the account deletes its consents', async () => {
  const storage = { deleteObject: jest.fn() } as unknown as S3StorageService;
  await new AccountErasureService(pool, storage).eraseAccount(user);
  const res = await as(request(app).get('/api/account/consent'));
  expect(res.body.data).toEqual({ currentVersion: CURRENT, acceptedVersion: null, acceptedAt: null });
});

test('an unauthenticated caller is refused', async () => {
  const res = await request(app).get('/api/account/consent');
  expect(res.status).toBe(401);
});
