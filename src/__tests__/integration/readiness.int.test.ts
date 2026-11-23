/**
 * /ready tells the platform whether this instance can serve traffic, which
 * needs the database; /health only says the process is alive. Shutdown has
 * to stop taking requests before it closes the pool those requests use.
 */
import request from 'supertest';
import express from 'express';
import http from 'http';
import { Pool } from 'pg';
import { readinessHandler } from '../../interfaces/http/readiness';
import { closeGracefully } from '../../infrastructure/utils/errors/ErrorHandler';

function appWith(pool: Pool) {
  const app = express();
  app.get('/ready', readinessHandler(pool));
  return app;
}

test('ready when the database answers', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await request(appWith(pool)).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
  } finally {
    await pool.end();
  }
});

test('503 when the database is down', async () => {
  const pool = new Pool({ connectionString: 'postgresql://nobody:x@127.0.0.1:1/none', connectionTimeoutMillis: 2000 });
  try {
    const res = await request(appWith(pool)).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('UNAVAILABLE');
  } finally {
    await pool.end();
  }
});

test('shutdown closes the server first, then the pool', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('SELECT 1');

  const order: string[] = [];
  server.on('close', () => order.push('server'));
  await closeGracefully(server, async () => {
    order.push('pool');
    await pool.end();
  });

  expect(order).toEqual(['server', 'pool']);
  expect(server.listening).toBe(false);
  expect(pool.ended).toBe(true);
});
