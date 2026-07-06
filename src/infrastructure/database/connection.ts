import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Only production (Render's managed Postgres) requires SSL. Forcing an SSL
  // handshake in other environments breaks against servers that don't offer
  // it at all — e.g. the plain postgres:16 service container used by CI.
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

export default pool;
