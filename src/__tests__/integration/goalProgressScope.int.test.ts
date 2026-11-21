/**
 * O lançamento de progresso não tem `child_id`: a única checagem de criança
 * é a da meta na URL. Apagar precisa exigir que o lançamento seja DESSA meta.
 */
import { randomUUID } from 'crypto';
import { GoalProgressService } from 'application/services/GoalProgressService';
import { PgGoalProgressEntryRepository } from 'infrastructure/repositories/PgGoalProgressEntryRepository';
import { PgGoalRepository } from 'infrastructure/repositories/PgGoalRepository';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';
import { runWithScope } from 'infrastructure/database/requestScope';
import pool from 'infrastructure/database/connection';

const owner = randomUUID();
const childA = randomUUID();
const childB = randomUUID();
const goalA = randomUUID();
const goalB = randomUUID();
const entryB = randomUUID();
const service = new GoalProgressService(new PgGoalProgressEntryRepository(), new PgGoalRepository());

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id, user_id, name) VALUES ($1, $3, 'A'), ($2, $3, 'B')`,
    [childA, childB, owner],
  );
  await pool.query(
    `INSERT INTO goals (id, user_id, child_id, domain, title) VALUES ($1, $3, $4, 'motor', 'Meta A'), ($2, $3, $5, 'motor', 'Meta B')`,
    [goalA, goalB, owner, childA, childB],
  );
  await pool.query(
    `INSERT INTO goal_progress_entries (id, user_id, goal_id, recorded_at) VALUES ($1, $2, $3, NOW())`,
    [entryB, owner, goalB],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM children WHERE user_id = $1`, [owner]);
  await pool.end();
});

test('cuidador delegado à criança A não apaga progresso da meta de B pela URL da meta de A', async () => {
  await runWithScope({ restrictedToChildId: childA }, async () => {
    await expect(service.remove(goalA, entryB, owner)).rejects.toThrow(NotFoundError);
  });
  const { rowCount } = await pool.query(`SELECT 1 FROM goal_progress_entries WHERE id = $1`, [entryB]);
  expect(rowCount).toBe(1);
});

test('o lançamento sai pela própria meta', async () => {
  await service.remove(goalB, entryB, owner);
  const { rowCount } = await pool.query(`SELECT 1 FROM goal_progress_entries WHERE id = $1`, [entryB]);
  expect(rowCount).toBe(0);
});
