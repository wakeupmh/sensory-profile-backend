import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { ConsentRecord } from '../../domain/entities/Consent';
import { ConsentRepository } from '../../domain/repositories/ConsentRepository';

function mapRow(row: { version: string; accepted_at: Date }): ConsentRecord {
  return { version: row.version, acceptedAt: row.accepted_at };
}

export class PgConsentRepository implements ConsentRepository {
  async findLatest(userId: string): Promise<ConsentRecord | null> {
    const { rows } = await pool.query(
      `SELECT version, accepted_at FROM consents WHERE user_id = $1 ORDER BY accepted_at DESC, version DESC LIMIT 1`,
      [userId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async accept(userId: string, version: string): Promise<ConsentRecord> {
    // The no-op update makes RETURNING yield the existing row on a repeat
    // accept, keeping its original accepted_at.
    const { rows } = await pool.query(
      `INSERT INTO consents (id, user_id, version) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, version) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING version, accepted_at`,
      [uuidv7(), userId, version],
    );
    return mapRow(rows[0]);
  }
}
