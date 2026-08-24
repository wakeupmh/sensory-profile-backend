/**
 * A reserva em lote precisa manter a garantia que a reserva unitária dava:
 * quem ganha a chave é exatamente uma execução. Contra Postgres real, porque
 * a garantia é do `ON CONFLICT`, não do TypeScript.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { PgReminderNotificationRepository } from 'infrastructure/repositories/PgReminderNotificationRepository';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repo = new PgReminderNotificationRepository();
const user = 'user-' + randomUUID().slice(0, 8);

afterAll(async () => {
  await pool.query('DELETE FROM reminder_notifications WHERE user_id = $1', [user]);
  await pool.end();
});

describe('reserveMany', () => {
  test('returns every key on a first run', async () => {
    const keys = ['a:1', 'a:2', 'a:3'];
    expect((await repo.reserveMany(user, keys, 'email')).sort()).toEqual(keys);
  });

  test('returns nothing the second time — no duplicate notification', async () => {
    expect(await repo.reserveMany(user, ['a:1', 'a:2', 'a:3'], 'email')).toEqual([]);
  });

  test('returns only the keys not yet reserved', async () => {
    expect(await repo.reserveMany(user, ['a:1', 'b:novo'], 'email')).toEqual(['b:novo']);
  });

  test('channels are independent — email and push both notify', async () => {
    expect((await repo.reserveMany(user, ['a:1'], 'push')).sort()).toEqual(['a:1']);
  });

  test('two concurrent runs cannot both win the same key', async () => {
    // O caso que a reserva existe para impedir: duas execuções sobrepostas
    // do digest não podem mandar o mesmo lembrete duas vezes.
    const key = 'race:' + randomUUID().slice(0, 8);
    const [first, second] = await Promise.all([
      repo.reserveMany(user, [key], 'email'),
      repo.reserveMany(user, [key], 'email'),
    ]);
    expect([...first, ...second]).toEqual([key]);
  });

  test('releaseMany puts the keys back for the next run', async () => {
    const keys = ['rel:1', 'rel:2'];
    await repo.reserveMany(user, keys, 'email');
    await repo.releaseMany(user, keys, 'email');
    expect((await repo.reserveMany(user, keys, 'email')).sort()).toEqual(keys);
  });

  test('an empty batch does not touch the database', async () => {
    expect(await repo.reserveMany(user, [], 'email')).toEqual([]);
    await expect(repo.releaseMany(user, [], 'email')).resolves.toBeUndefined();
  });
});
