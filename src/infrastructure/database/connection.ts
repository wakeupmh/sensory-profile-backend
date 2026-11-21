import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// `date` é dia de calendário, sem fuso. O parser padrão do pg o converte em
// meia-noite LOCAL, e o JSON sai como timestamp UTC ("2026-03-10T00:00:00.000Z")
// — um dia antes no Brasil e "Invalid Date" no front. Mantém o texto do banco.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Conexões ociosas não seguram o processo aberto (encerramento e jest).
  allowExitOnIdle: true,
  // Only production (Render's managed Postgres) requires SSL. Forcing an SSL
  // handshake in other environments breaks against servers that don't offer
  // it at all — e.g. the plain postgres:16 service container used by CI.
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

export default pool;
