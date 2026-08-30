/**
 * A trilha de acesso é o que o responsável tem para enxergar o que terceiros
 * fizeram com os dados da criança. Ela estava quebrada dos dois lados:
 *
 * 1. O middleware de delegação gravava a URL inteira em `resource_type`, que
 *    é `VARCHAR(50)`. `delegated:PATCH:/api/daily-reports/<uuid>` dá 71
 *    caracteres, o INSERT estourava com 22001 e `AccessLogService.record`
 *    engolia a exceção — então TODA ação sobre um registro específico sumia
 *    da trilha, em silêncio, enquanto as de coleção (URL curta) ficavam.
 * 2. A listagem não devolvia nome nenhum, e a tela mostrava "Você" em todas
 *    as linhas — inclusive nas de outra pessoa.
 *
 * Contra Postgres real, porque as duas garantias são do banco: a largura da
 * coluna e os joins de nome.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { PgAccessLogRepository } from 'infrastructure/repositories/PgAccessLogRepository';
import { auditTargetFromPath } from 'interfaces/http/middleware/auditTarget';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repo = new PgAccessLogRepository();

const owner = 'owner-' + randomUUID().slice(0, 8);
const caregiver = 'caregiver-' + randomUUID().slice(0, 8);
const childId = randomUUID();
const professionalId = randomUUID();

/** Só o que `auditTargetFromPath` lê. */
function req(baseUrl: string, path: string): Request {
  return { baseUrl, path } as Request;
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id, user_id, name, birth_date) VALUES ($1, $2, 'Criança Teste', '2018-01-01')`,
    [childId, owner],
  );
  await pool.query(
    `INSERT INTO caregiver_shares (id, child_id, owner_user_id, caregiver_name, caregiver_user_id, accepted_at)
     VALUES ($1, $2, $3, 'Tia Marta', $4, CURRENT_TIMESTAMP)`,
    [randomUUID(), childId, owner, caregiver],
  );
  await pool.query(
    `INSERT INTO professionals (id, owner_user_id, name) VALUES ($1, $2, 'Dra. Helena')`,
    [professionalId, owner],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM children WHERE id = $1', [childId]);
  await pool.query('DELETE FROM professionals WHERE id = $1', [professionalId]);
  await pool.end();
});

describe('auditTargetFromPath', () => {
  test('separa a coleção do id, em vez de empilhar a URL inteira', () => {
    expect(auditTargetFromPath(req('/api/daily-reports', `/${childId}`))).toEqual({
      resourceType: 'daily_reports',
      resourceId: childId,
    });
  });

  test('descarta o segmento children/<uuid> — a criança já vai em child_id', () => {
    expect(auditTargetFromPath(req('/api/children', `/${childId}/access-logs`))).toEqual({
      resourceType: 'access_logs',
      resourceId: null,
    });
  });

  test('sub-recurso não desloca a coleção nem o id', () => {
    const id = randomUUID();
    expect(auditTargetFromPath(req('/api/daily-reports', `/${id}/audio`))).toEqual({
      resourceType: 'daily_reports',
      resourceId: id,
    });
  });

  test('nenhuma rota auditada gera um resource_type que não caiba na coluna', () => {
    const routes: Array<[string, string]> = [
      ['/api/daily-reports', `/${randomUUID()}`],
      ['/api/daily-logs', `/${randomUUID()}`],
      ['/api/developmental-milestones', `/${randomUUID()}`],
      ['/api/school-communications', `/${randomUUID()}`],
      ['/api/medical-appointments', `/${randomUUID()}`],
      ['/api/children', `/${childId}/care-team`],
    ];
    for (const [baseUrl, path] of routes) {
      // O valor antigo, `delegated:${method}:${baseUrl}${path}`, passava de 50
      // em todas estas — era exatamente por isso que a linha se perdia.
      expect(auditTargetFromPath(req(baseUrl, path)).resourceType.length).toBeLessThanOrEqual(50);
    }
  });
});

describe('gravação e leitura da trilha', () => {
  test('a ação sobre um registro específico deixa rastro (antes era engolida)', async () => {
    const target = auditTargetFromPath(req('/api/daily-reports', `/${randomUUID()}`));

    // `record` engole exceções de propósito, então a prova é a linha existir,
    // não a chamada não lançar.
    await repo.record({
      actorUserId: caregiver,
      childId,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      action: 'write',
    });

    const { data } = await repo.listForChild(childId, 1, 20);
    const row = data.map((l) => l.toJSON()).find((l) => l.resourceType === 'daily_reports');
    expect(row).toBeDefined();
    expect(row!.resourceId).toBe(target.resourceId);
    expect(row!.action).toBe('write');
  });

  test('a linha de um cuidador delegado sai com o nome dele, não como "Você"', async () => {
    await repo.record({
      actorUserId: caregiver,
      childId,
      resourceType: 'daily_logs',
      action: 'read',
    });

    const { data } = await repo.listForChild(childId, 1, 20);
    const row = data.map((l) => l.toJSON()).find((l) => l.resourceType === 'daily_logs');
    expect(row!.actorUserId).toBe(caregiver);
    expect(row!.actorName).toBe('Tia Marta');
  });

  test('a linha de um profissional sai com o nome do profissional', async () => {
    await repo.record({
      actorUserId: 'algum-usuario-do-profissional',
      professionalId,
      childId,
      resourceType: 'anamnese',
      action: 'read',
    });

    const { data } = await repo.listForChild(childId, 1, 20);
    const row = data.map((l) => l.toJSON()).find((l) => l.resourceType === 'anamnese');
    expect(row!.actorName).toBe('Dra. Helena');
  });

  test('ator desconhecido fica sem nome — não se inventa identidade', async () => {
    await repo.record({
      actorUserId: 'ninguem-conhecido',
      childId,
      resourceType: 'goals',
      action: 'read',
    });

    const { data } = await repo.listForChild(childId, 1, 20);
    const row = data.map((l) => l.toJSON()).find((l) => l.resourceType === 'goals');
    expect(row!.actorName).toBeNull();
  });
});
