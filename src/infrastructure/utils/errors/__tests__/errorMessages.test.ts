import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../ErrorHandler';
import { NotFoundError, ChildNotFoundError, AuthenticationError } from '../CustomErrors';

function run(error: Error): { status: number; body: any } {
  let status = 0;
  let body: any = {};
  const res = {
    status: (s: number) => {
      status = s;
      return res;
    },
    json: (b: unknown) => {
      body = b;
      return res;
    },
  } as unknown as Response;
  errorHandler(error, { method: 'GET', url: '/x', headers: {} } as unknown as Request, res, (() => {}) as NextFunction);
  return { status, body };
}

describe('mensagens de erro voltadas ao usuário', () => {
  it('NotFoundError não duplica o "não encontrado" de rótulos prontos', () => {
    expect(new NotFoundError('Lembrete não encontrado', 'abc').message).toBe('Lembrete não encontrado (abc)');
    expect(new NotFoundError('Lembrete não encontrado').message).toBe('Lembrete não encontrado');
  });

  it('NotFoundError em português para rótulos simples', () => {
    expect(new NotFoundError('Terapeuta', 'abc').message).toBe('Terapeuta não encontrado(a) (abc)');
    expect(new ChildNotFoundError('abc').message).toBe('Criança não encontrado(a) (abc)');
  });

  it('401 padrão em português', () => {
    const { status, body } = run(new AuthenticationError());
    expect(status).toBe(401);
    expect(body.error.message).toBe('Autenticação necessária');
  });

  it('erro desconhecido vira 500 genérico em português, sem vazar a causa', () => {
    const { status, body } = run(new Error('relation "secret_table" does not exist'));
    expect(status).toBe(500);
    expect(body.error.message).toBe('Ocorreu um erro inesperado. Tente novamente.');
    expect(JSON.stringify(body)).not.toContain('secret_table');
    expect(body.error.stack).toBeUndefined();
  });

  it('erro de banco desconhecido vira 500 genérico em português', () => {
    const pgErr = Object.assign(new Error('deadlock on table x'), { code: '99999' });
    const { status, body } = run(pgErr);
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('table x');
    expect(body.error.message).toMatch(/Tente novamente/);
  });
});

describe('corpo de requisição malformado', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const request = require('supertest');
  const app = express();
  app.use(express.json({ limit: '10b' }));
  app.post('/x', (_req: Request, res: Response) => res.json({ ok: true }));
  app.use(errorHandler);

  it('JSON inválido é 400, não 500', async () => {
    const res = await request(app).post('/x').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it('corpo grande demais é 413', async () => {
    const res = await request(app).post('/x').set('Content-Type', 'application/json').send('{"a":"0123456789"}');
    expect(res.status).toBe(413);
  });
});
