/**
 * A equipe de cuidado ponta a ponta, contra Postgres real: o profissional
 * ALCANÇA o que foi concedido e NÃO alcança o resto.
 *
 * Os testes do escopo provam a forma do SQL; este prova o efeito. É a
 * distinção que já custou caro aqui: um guard que casava uma string literal
 * passou verde com catorze caminhos de UPDATE abertos.
 *
 * O que se afirma aqui, nesta ordem de importância:
 *  1. a concessão NÃO alcança o registro de uma criança não concedida;
 *  2. a concessão NÃO renomeia nem APAGA a criança — `PgChildRepository`
 *     compartilha `scopedById` entre ler e apagar, e é o lugar exato onde
 *     "deixar o profissional abrir a ficha" viraria "deixar o profissional
 *     apagar a criança da família";
 *  3. revogar corta o acesso na hora;
 *  4. responsável sem equipe não muda de comportamento;
 *  5. e só então: a concessão de fato alcança o que devia.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { PgDailyLogRepository } from 'infrastructure/repositories/PgDailyLogRepository';
import { PgChildRepository } from 'infrastructure/repositories/PgChildRepository';
import { runWithScope } from 'infrastructure/database/requestScope';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logs = new PgDailyLogRepository();
const children = new PgChildRepository();

const owner = 'owner-' + randomUUID().slice(0, 8);
const otherOwner = 'owner-' + randomUUID().slice(0, 8);
const therapist = 'therapist-' + randomUUID().slice(0, 8);

const grantedChild = randomUUID();   // do `owner`, concedida ao terapeuta
const privateChild = randomUUID();   // do MESMO `owner`, NÃO concedida
const strangerChild = randomUUID();  // de outra família

const grantedLog = randomUUID();
const privateLog = randomUUID();
const strangerLog = randomUUID();

/**
 * O escopo que `careTeamScopeMiddleware` monta para o profissional.
 *
 * Note que o `userId` passado às consultas é o do PRÓPRIO profissional, e não
 * o do responsável: `requireUserId` só resolve para o dono sob delegação, e a
 * equipe de cuidado não passa por delegação. É esse o ponto do modelo — o
 * predicado do dono não casa, e o acesso tem de vir da concessão ou de lugar
 * nenhum.
 */
function asTherapist<T>(fn: () => Promise<T>, grants: string[] = [grantedChild]): Promise<T> {
  return runWithScope({ actingUserId: therapist, careTeamChildIds: grants }, fn);
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id,user_id,name,birth_date) VALUES
       ($1,$2,'Criança Concedida','2019-01-01'),
       ($3,$2,'Criança Privada','2020-01-01'),
       ($4,$5,'Criança de Outra Família','2021-01-01')`,
    [grantedChild, owner, privateChild, strangerChild, otherOwner],
  );
  await pool.query(
    `INSERT INTO daily_logs (id,user_id,child_id,log_type,occurred_at,data,notes) VALUES
       ($1,$2,$3,'mood',NOW(),'{}','registro da criança concedida'),
       ($4,$2,$5,'mood',NOW(),'{}','registro que o profissional não pode ver'),
       ($6,$7,$8,'mood',NOW(),'{}','registro de outra família')`,
    [grantedLog, owner, grantedChild, privateLog, privateChild, strangerLog, otherOwner, strangerChild],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM children WHERE id = ANY($1::uuid[])', [
    [grantedChild, privateChild, strangerChild],
  ]);
  await pool.end();
});

describe('o que a concessão NÃO alcança', () => {
  test('outra criança do MESMO responsável continua fora — mesmo sabendo o id', async () => {
    expect(await asTherapist(() => logs.findById(privateLog, therapist))).toBeNull();
  });

  test('a criança de outra família continua fora', async () => {
    expect(await asTherapist(() => logs.findById(strangerLog, therapist))).toBeNull();
  });

  test('não dá para alterar o registro de uma criança não concedida', async () => {
    const updated = await asTherapist(() =>
      logs.update(privateLog, therapist, { notes: 'ALTERADO POR QUEM NAO PODIA' }),
    );
    expect(updated).toBeNull();

    const { rows } = await pool.query('SELECT notes FROM daily_logs WHERE id = $1', [privateLog]);
    expect(rows[0].notes).toBe('registro que o profissional não pode ver');
  });

  test('não dá para apagar o registro de uma criança não concedida', async () => {
    expect(await asTherapist(() => logs.delete(privateLog, therapist))).toBe(false);
    const { rows } = await pool.query('SELECT 1 FROM daily_logs WHERE id = $1', [privateLog]);
    expect(rows).toHaveLength(1);
  });
});

describe('a criança em si: ler sim, mexer não', () => {
  test('o profissional abre a ficha da criança concedida', async () => {
    const child = await asTherapist(() => children.findById(grantedChild, therapist));
    expect(child).not.toBeNull();
    expect(child!.toJSON().name).toBe('Criança Concedida');
  });

  test('a criança NÃO concedida do mesmo responsável continua fora', async () => {
    expect(await asTherapist(() => children.findById(privateChild, therapist))).toBeNull();
  });

  test('o profissional NÃO renomeia a criança da família', async () => {
    const updated = await asTherapist(() =>
      children.update(grantedChild, therapist, { name: 'RENOMEADA POR QUEM NAO PODIA' }),
    );
    expect(updated).toBeNull();

    const { rows } = await pool.query('SELECT name FROM children WHERE id = $1', [grantedChild]);
    expect(rows[0].name).toBe('Criança Concedida');
  });

  test('o profissional NÃO apaga a criança da família', async () => {
    // `findById` e `delete` dividiam o mesmo helper de escopo: ensinar a
    // concessão no lugar errado transformaria "abrir a ficha" em "apagar a
    // criança". Este é o teste que guarda essa fronteira.
    expect(await asTherapist(() => children.delete(grantedChild, therapist))).toBe(false);

    const { rows } = await pool.query('SELECT 1 FROM children WHERE id = $1', [grantedChild]);
    expect(rows).toHaveLength(1);
  });

  test('o responsável continua podendo renomear a própria criança', async () => {
    const updated = await children.update(grantedChild, owner, { name: 'Criança Concedida' });
    expect(updated).not.toBeNull();
  });
});

describe('revogação e ausência de equipe', () => {
  test('sem concessão nenhuma, o profissional não alcança nada — como antes', async () => {
    expect(await asTherapist(() => logs.findById(grantedLog, therapist), [])).toBeNull();
    expect(await asTherapist(() => children.findById(grantedChild, therapist), [])).toBeNull();
  });

  test('o responsável sem equipe enxerga as próprias crianças normalmente', async () => {
    const child = await children.findById(privateChild, owner);
    expect(child).not.toBeNull();
    const log = await logs.findById(privateLog, owner);
    expect(log).not.toBeNull();
  });
});

describe('o que a concessão alcança', () => {
  test('o profissional lê o registro da criança concedida', async () => {
    const log = await asTherapist(() => logs.findById(grantedLog, therapist));
    expect(log).not.toBeNull();
    expect(log!.toJSON().notes).toBe('registro da criança concedida');
  });

  test('o profissional registra e edita o log da criança concedida', async () => {
    const updated = await asTherapist(() =>
      logs.update(grantedLog, therapist, { notes: 'observação da sessão de hoje' }),
    );
    expect(updated).not.toBeNull();
    expect(updated!.toJSON().notes).toBe('observação da sessão de hoje');
  });

  test('a listagem do profissional traz a criança concedida e só ela', async () => {
    const { data } = await asTherapist(() => logs.findAllByUser(therapist, { limit: 100 }));
    const ids = data.map((l) => l.childId);
    expect(ids).toContain(grantedChild);
    expect(ids).not.toContain(privateChild);
    expect(ids).not.toContain(strangerChild);
  });
});
