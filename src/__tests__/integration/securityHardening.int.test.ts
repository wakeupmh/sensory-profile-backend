/**
 * Regressões de endurecimento. Cada caso corresponde a uma falha encontrada
 * numa auditoria e verificada antes da correção.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const CHILD = '11111111-1111-1111-1111-111111111111';
const doc = (mimeType: string) => ({ childId: CHILD, title: 'x', mimeType });
import { requestUploadSchema } from 'interfaces/http/validations/documentValidation';
import { requestAttachmentUploadSchema } from 'interfaces/http/validations/logAttachmentValidation';
import { isRelaxedEnvironment } from 'interfaces/http/middleware/rateLimiters';
import { PgAnamneseRepository } from 'infrastructure/repositories/PgAnamneseRepository';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => {
  await pool.end();
});

describe('SVG não é aceito como imagem', () => {
  test('rejects a scriptable SVG that the image/ prefix would otherwise allow', () => {
    expect(() => requestUploadSchema.parse(doc('image/svg+xml'))).toThrow();
    expect(() => requestAttachmentUploadSchema.parse({ mimeType: 'image/svg+xml' })).toThrow();
    // Com parâmetro e caixa alta — a checagem não pode ser contornada assim.
    expect(() => requestAttachmentUploadSchema.parse({ mimeType: 'IMAGE/SVG+XML; charset=utf-8' })).toThrow();
  });

  test('still accepts the image types the app actually uses', () => {
    expect(requestAttachmentUploadSchema.parse({ mimeType: 'image/jpeg' }).mimeType).toBe('image/jpeg');
    expect(requestUploadSchema.parse(doc('application/pdf')).mimeType).toBe('application/pdf');
  });
});

describe('proteções não somem quando NODE_ENV falta', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  });

  test('an unset or misspelled NODE_ENV keeps rate limiting and CSP on', () => {
    // Antes, qualquer coisa != 'production' desligava as duas: um deploy que
    // esquecesse a variável subia saudável e sem nenhuma proteção.
    delete process.env.NODE_ENV;
    expect(isRelaxedEnvironment()).toBe(false);
    process.env.NODE_ENV = 'producton';
    expect(isRelaxedEnvironment()).toBe(false);
    process.env.NODE_ENV = 'staging';
    expect(isRelaxedEnvironment()).toBe(false);
  });

  test('only a declared development or test environment relaxes them', () => {
    process.env.NODE_ENV = 'development';
    expect(isRelaxedEnvironment()).toBe(true);
    process.env.NODE_ENV = 'test';
    expect(isRelaxedEnvironment()).toBe(true);
  });
});

describe('link público de anamnese expira', () => {
  const repo = new PgAnamneseRepository();
  const userId = 'owner-' + randomUUID().slice(0, 8);

  async function seedShared(token: string, sharedDaysAgo: number): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO anamneses (id, user_id, child, caregiver, clinical_history, share_token, shared_at, created_at, updated_at)
       VALUES ($1, $2, '{"name":"x"}'::jsonb, '{}'::jsonb, '{}'::jsonb, $3,
               NOW() - ($4 || ' days')::interval, NOW(), NOW())`,
      [id, userId, token, sharedDaysAgo],
    );
    return id;
  }

  afterAll(async () => {
    await pool.query('DELETE FROM anamneses WHERE user_id = $1', [userId]);
  });

  test('a freshly shared link still resolves', async () => {
    const token = 'tok-fresh-' + randomUUID().slice(0, 8);
    await seedShared(token, 1);
    expect(await repo.findByShareToken(token)).not.toBeNull();
  });

  test('a link shared beyond the validity window no longer resolves', async () => {
    // Este é o caso real: um profissional que recebeu o link há anos e mudou
    // de emprego continuava com acesso ao prontuário inteiro, sem autenticação.
    const token = 'tok-stale-' + randomUUID().slice(0, 8);
    await seedShared(token, 400);
    expect(await repo.findByShareToken(token)).toBeNull();
  });
});
