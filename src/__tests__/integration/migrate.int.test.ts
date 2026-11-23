/**
 * Every instance runs the migrations when it starts. Two instances that start
 * together must not apply the same file twice, so the run waits on a Postgres
 * advisory lock while another instance holds it.
 */
import { Pool } from 'pg';
import { MIGRATION_LOCK_KEY, runMigrations } from '../../migrate';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const silent = () => {};

afterAll(async () => {
  await pool.end();
});

test('a database that is up to date applies nothing', async () => {
  await runMigrations(pool, silent);
  await expect(runMigrations(pool, silent)).resolves.toEqual([]);
});

test('the run waits while another instance holds the migration lock', async () => {
  const other = await pool.connect();
  try {
    await other.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    let finished = false;
    const run = runMigrations(pool, silent).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(finished).toBe(false);

    await other.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    await run;
    expect(finished).toBe(true);
  } finally {
    other.release();
  }
});
