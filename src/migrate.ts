/**
 * Applies pending SQL files under migrations/ in filename order, tracking
 * which ones have already run in a schema_migrations table, so re-running it
 * is a no-op once everything is applied.
 *
 * It lives in src/ so `tsc` emits dist/migrate.js: the production image runs
 * it with plain node before the server starts.
 *
 * Every instance runs it on start. A session-level advisory lock serializes
 * concurrent runs; the applied set is read only after the lock is held, so the
 * second instance sees the first one's work and skips it. A crash releases the
 * lock with the session.
 *
 * Each migration runs in its own transaction; a failure rolls back that one
 * file and stops before recording it, leaving it pending for the next run.
 */
import fs from 'fs';
import path from 'path';
import type { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Arbitrary constant shared by every instance of this app.
export const MIGRATION_LOCK_KEY = 7_340_211_563;

export async function runMigrations(pool: Pool, log: (message: string) => void = console.log): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
      const applied = new Set(rows.map((r) => r.filename));

      const pending = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .filter((f) => !applied.has(f));

      if (pending.length === 0) {
        log('No pending migrations — schema is up to date.');
        return [];
      }

      for (const filename of pending) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
        log(`Applying ${filename}...`);
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          log(`Failed applying ${filename}, rolled back. Remaining migrations were not run.`);
          throw error;
        }
      }

      log(`Applied ${pending.length} migration(s).`);
      return pending;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  // Loaded here, not at the top, so importing runMigrations does not open the
  // app's pool.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pool: Pool = require('./infrastructure/database/connection').default;
  runMigrations(pool)
    .then(() => pool.end())
    .catch((error) => {
      console.error('Migration run failed:', error);
      process.exit(1);
    });
}
