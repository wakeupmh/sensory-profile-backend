/**
 * Applies pending SQL files under migrations/ in filename order, tracking
 * which ones have already run in a schema_migrations table so re-running
 * this script (locally or in CI) is a no-op once everything is applied.
 *
 * Each migration runs in its own transaction; a failure rolls back that one
 * file and stops before recording it, leaving it "pending" for the next run.
 */
import fs from 'fs';
import path from 'path';
import pool from '../src/infrastructure/database/connection';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations',
    );
    const applied = new Set(rows.map((r) => r.filename));

    const pending = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations — schema is up to date.');
      return;
    }

    for (const filename of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      console.log(`Applying ${filename}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed applying ${filename}, rolled back. Remaining migrations were not run.`);
        throw error;
      }
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exit(1);
});
