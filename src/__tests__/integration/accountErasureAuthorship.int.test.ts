/**
 * Real-Postgres regression test for the LGPD gap described in the care-team
 * work: a professional who WRITES into a family's records (author_user_id)
 * is never the OWNER of those rows, so `AccountErasureService`'s
 * owner-scoped `DELETE`s — and the `ON DELETE CASCADE` from `children` —
 * never reach them when the PROFESSIONAL erases their own account. Their
 * Supabase `sub` would otherwise stay stamped on another family's daily log
 * forever, even though that family never asked for anything to be erased.
 *
 * `accountErasureCoverage.int.test.ts` is the STATIC guard (every
 * user-identifying column is classified into a bucket); this file is the
 * BEHAVIOURAL one — it seeds real rows, runs the real service against real
 * Postgres, and checks what is actually left in the table afterwards. A
 * guard test can pass on day one and stay green forever while the service
 * itself does nothing about the column it "classified" — only exercising
 * `eraseAccount` catches that.
 *
 * Scenario: child belongs to OWNER. A daily_log on that child carries
 * author_user_id = PROFESSIONAL (they wrote it under a care-team grant).
 * PROFESSIONAL erases their own account. Expected: the log ROW SURVIVES
 * (it's the family's data, not the professional's — they never asked for it
 * to be deleted) but author_user_id is NULL (the professional's identity is
 * gone, per LGPD Art. 18 VI).
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { AccountErasureService } from 'application/services/AccountErasureService';
import { S3StorageService } from 'infrastructure/storage/S3StorageService';

const OWNER = `test-owner-${uuidv7()}`;
const PROFESSIONAL = `test-professional-${uuidv7()}`;
const CHILD_ID = uuidv7();
const LOG_ID = uuidv7();

/** eraseAccount never calls S3 for a professional who owns no children/documents — a stub is enough. */
function makeStorageStub(): S3StorageService {
  return {
    deleteObject: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn(),
    getDownloadUrl: jest.fn(),
    getUploadUrl: jest.fn(),
  } as unknown as S3StorageService;
}

async function careTeamMembersExists(): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'care_team_members'`,
  );
  return rows.length > 0;
}

describe('AccountErasureService — authorship on records the erasing user does not own (real Postgres)', () => {
  let membershipId: string | null = null;

  beforeAll(async () => {
    await pool.query(`INSERT INTO children (id, name, user_id) VALUES ($1, 'Criança do responsável', $2)`, [
      CHILD_ID,
      OWNER,
    ]);
    // O registro é do RESPONSÁVEL (user_id = OWNER); o PROFISSIONAL só é o
    // autor — exatamente o desenho que o care team introduz.
    await pool.query(
      `INSERT INTO daily_logs (id, user_id, author_user_id, child_id, log_type, occurred_at, data, notes)
       VALUES ($1, $2, $3, $4, 'mood', NOW(), '{}'::jsonb, NULL)`,
      [LOG_ID, OWNER, PROFESSIONAL, CHILD_ID],
    );

    if (await careTeamMembersExists()) {
      membershipId = uuidv7();
      await pool.query(
        `INSERT INTO care_team_members
           (id, child_id, member_user_id, member_name, role, granted_by_user_id, accepted_at)
         VALUES ($1, $2, $3, 'Fono da criança', 'fonoaudiologia', $4, NOW())`,
        [membershipId, CHILD_ID, PROFESSIONAL, OWNER],
      );
    }

    // Uma única eliminação para os dois testes lerem: eraseAccount não é o
    // que está sob teste em si (isso é AccountErasureService.int.test.ts),
    // é o efeito dela sobre linhas de OUTRA pessoa que este arquivo verifica.
    const service = new AccountErasureService(pool, makeStorageStub());
    await service.eraseAccount(PROFESSIONAL);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM daily_logs WHERE id = $1`, [LOG_ID]);
    if (membershipId) await pool.query(`DELETE FROM care_team_members WHERE id = $1`, [membershipId]);
    await pool.query(`DELETE FROM children WHERE id = $1`, [CHILD_ID]);
    await pool.end();
  });

  test('erasing the PROFESSIONAL keeps the family\'s log row but clears author_user_id', async () => {
    const { rows } = await pool.query(`SELECT user_id, author_user_id FROM daily_logs WHERE id = $1`, [LOG_ID]);
    expect(rows).toHaveLength(1); // the row survives — it belongs to the family, not the professional
    expect(rows[0].user_id).toBe(OWNER); // ownership never moves
    expect(rows[0].author_user_id).toBeNull(); // but the professional's identity is gone

    // The owner's own account is untouched — this erasure was scoped to the
    // professional, not the family.
    const child = await pool.query(`SELECT 1 FROM children WHERE id = $1`, [CHILD_ID]);
    expect(child.rows).toHaveLength(1);
  });

  test('erasing the PROFESSIONAL neutralises their care_team_members membership, not the grant itself', async () => {
    if (!membershipId) {
      // migrations/035 not applied in this run — the guarded path
      // in AccountErasureService is exercised by the mock suite instead.
      return;
    }
    const { rows } = await pool.query(
      `SELECT member_user_id, granted_by_user_id, revoked_at FROM care_team_members WHERE id = $1`,
      [membershipId],
    );
    expect(rows).toHaveLength(1); // the grant record survives — it's the responsável's audit trail
    expect(rows[0].granted_by_user_id).toBe(OWNER);
    expect(rows[0].member_user_id).toBeNull();
    expect(rows[0].revoked_at).not.toBeNull();
  });
});
