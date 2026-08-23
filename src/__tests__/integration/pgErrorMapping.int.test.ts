/**
 * O mapeador de erros de banco nunca executou: ele testava
 * `error.name === 'QueryFailedError'`, que é o nome do TypeORM, enquanto o
 * node-postgres define `name: 'error'` e põe o SQLSTATE em `.code`. Resultado:
 * toda violação de constraint virava 500 (e alerta) em vez do 4xx que ela é.
 *
 * Estes casos usam erros REAIS do driver — produzidos pelo Postgres, não
 * fabricados à mão — justamente porque a forma do erro é o que estava errado.
 */
import { Pool } from 'pg';
import { errorHandler } from 'infrastructure/utils/errors/ErrorHandler';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

afterAll(async () => {
  await pool.end();
});

/** Captura o status/corpo que o errorHandler produziria para um erro real. */
function runHandler(error: Error): { status: number; body: Record<string, unknown> } {
  let status = 0;
  let body: Record<string, unknown> = {};
  const res = {
    status: (s: number) => {
      status = s;
      return res;
    },
    json: (b: Record<string, unknown>) => {
      body = b;
      return res;
    },
  } as unknown as Response;
  errorHandler(error, { method: 'POST', originalUrl: '/x', headers: {} } as unknown as Request, res, (() => {}) as NextFunction);
  return { status, body };
}

async function capturePgError(sql: string, params: unknown[]): Promise<Error> {
  try {
    await pool.query(sql, params);
    throw new Error('esperava um erro do Postgres');
  } catch (e) {
    return e as Error;
  }
}

describe('mapeamento de erros do Postgres (SQLSTATE)', () => {
  test('the driver identifies itself by SQLSTATE, not by a class name', async () => {
    const error = await capturePgError(
      `INSERT INTO children (id, user_id, name, birth_date) VALUES ($1,$2,$3,$4)`,
      ['nao-e-uuid', 'u', 'x', '2020-01-01'],
    );
    // A premissa do código antigo, explicitada: o nome NÃO é QueryFailedError.
    expect(error.name).not.toBe('QueryFailedError');
    expect((error as unknown as { code: string }).code).toBe('22P02');
  });

  test('a foreign key violation is a 400, not a 500', async () => {
    const error = await capturePgError(
      `INSERT INTO daily_logs (id, user_id, child_id, log_type, occurred_at, data)
       VALUES ($1,$2,$3,'mood',NOW(),'{}')`,
      [randomUUID(), 'u', randomUUID()],
    );
    expect(runHandler(error).status).toBe(400);
  });

  test('a not-null violation is a 400, not a 500', async () => {
    const error = await capturePgError(
      `INSERT INTO children (id, user_id, name, birth_date) VALUES ($1,$2,NULL,$3)`,
      [randomUUID(), 'u', '2020-01-01'],
    );
    expect(runHandler(error).status).toBe(400);
  });

  test('a check violation is a 400, not a 500', async () => {
    const childId = randomUUID();
    const owner = 'owner-' + randomUUID().slice(0, 8);
    await pool.query(`INSERT INTO children (id,user_id,name,birth_date) VALUES ($1,$2,'x','2020-01-01')`, [childId, owner]);
    const error = await capturePgError(
      `INSERT INTO daily_reports (id, user_id, child_id, report_date, status)
       VALUES ($1,$2,$3,'2026-01-01','status_invalido')`,
      [randomUUID(), owner, childId],
    );
    await pool.query('DELETE FROM children WHERE id = $1', [childId]);
    expect(runHandler(error).status).toBe(400);
  });

  test('a unique violation is a 409, not a 500', async () => {
    const owner = 'owner-' + randomUUID().slice(0, 8);
    const childId = randomUUID();
    await pool.query(`INSERT INTO children (id,user_id,name,birth_date) VALUES ($1,$2,'x','2020-01-01')`, [childId, owner]);
    await pool.query(
      `INSERT INTO daily_reports (id,user_id,child_id,report_date,status) VALUES ($1,$2,$3,'2026-01-01','draft')`,
      [randomUUID(), owner, childId],
    );
    // UNIQUE (child_id, report_date)
    const error = await capturePgError(
      `INSERT INTO daily_reports (id,user_id,child_id,report_date,status) VALUES ($1,$2,$3,'2026-01-01','draft')`,
      [randomUUID(), owner, childId],
    );
    await pool.query('DELETE FROM children WHERE id = $1', [childId]);

    const { status } = runHandler(error);
    expect(status).toBe(409);
  });

  test('an unrecognized failure still becomes a 500', () => {
    expect(runHandler(new Error('algo genérico')).status).toBe(500);
  });
});
