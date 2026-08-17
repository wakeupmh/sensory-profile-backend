import { Pool } from 'pg';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';

export interface AccountErasureResult {
  childrenDeleted: number;
  storageObjectsDeleted: number;
}

/**
 * LGPD Art. 18 VI (eliminação) support. Two jobs:
 *
 *  1. `collectChildStorageKeys` — every table with an S3-backed file
 *     (documents, log photo attachments) is `ON DELETE CASCADE`d from
 *     `children`, so the *rows* disappear automatically when a child is
 *     deleted, but nobody ever told S3. This must run BEFORE the delete —
 *     once the child is gone, the keys are gone with it.
 *
 *  2. `eraseAccount` — a full account wipe. Unlike ChildService.delete
 *     (which deliberately refuses to delete a child with assessments, to
 *     protect against accidental data loss during normal use), an erasure
 *     request has to succeed regardless of what the account contains, so
 *     this deletes assessments first rather than being blocked by them.
 *     It also reaches the handful of tables that aren't FK-linked to
 *     children at all (anamneses store a JSONB snapshot of the child, not
 *     a child_id — see AnamneseChild) or aren't child-scoped in the first
 *     place (professionals, drafts, reminder notification history).
 *
 * Does not delete the Supabase Auth identity itself — this backend holds
 * no service-role Supabase credentials (see authMiddleware.ts), so the
 * email/password account continues to exist after this runs. That's a
 * separate decision (whether to provision admin credentials here) from
 * "does the app un-know everything about this person's children."
 */

/**
 * Every user-scoped table that does NOT cascade away with `children`, so it
 * has to be deleted by name. Each entry takes `$1 = userId`.
 *
 * A hand-written list is the weak point of this whole feature — it silently
 * rots every time a user-scoped table is added (`push_subscriptions` landed
 * here exactly that way, from a PR merged while this one was open). The
 * companion test `accountErasureCoverage.int.test.ts` reads the live schema
 * and fails if any user-scoped table is missing from the classification
 * below, so adding a table forces a decision instead of a silent leak.
 */
const ACCOUNT_SCOPED_DELETES = [
  `DELETE FROM anamneses WHERE user_id = $1`,
  `DELETE FROM professionals WHERE owner_user_id = $1`,
  `DELETE FROM form_drafts WHERE user_id = $1`,
  `DELETE FROM reminder_notifications WHERE user_id = $1`,
  `DELETE FROM caregiver_shares WHERE caregiver_user_id = $1`,
  `DELETE FROM push_subscriptions WHERE user_id = $1`,
  // Contatos cadastrados pelo usuário: guardam nome/telefone/e-mail de
  // pessoas reais e não têm child_id, então nenhum cascade os alcança.
  `DELETE FROM therapists WHERE user_id = $1`,
  `DELETE FROM examiners WHERE user_id = $1`,
  `DELETE FROM caregivers WHERE user_id = $1`,
  // Por último: as tabelas acima podem ser lidas por triggers/FKs antes disto.
  `DELETE FROM user_profiles WHERE user_id = $1`,
] as const;

export class AccountErasureService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService,
  ) {}

  async collectChildStorageKeys(userId: string, childId: string): Promise<string[]> {
    const [documentsResult, attachmentsResult] = await Promise.all([
      this.pool.query(`SELECT storage_key FROM documents WHERE user_id = $1 AND child_id = $2`, [userId, childId]),
      this.pool.query(
        `SELECT la.storage_key FROM log_attachments la
         JOIN daily_logs dl ON dl.id = la.log_id
         WHERE dl.user_id = $1 AND dl.child_id = $2`,
        [userId, childId],
      ),
    ]);
    return [
      ...documentsResult.rows.map((r) => r.storage_key as string),
      ...attachmentsResult.rows.map((r) => r.storage_key as string),
    ];
  }

  async deleteStorageKeys(keys: string[]): Promise<number> {
    const results = await Promise.allSettled(keys.map((key) => this.storage.deleteObject(key)));
    return results.filter((r) => r.status === 'fulfilled').length;
  }

  async eraseAccount(userId: string): Promise<AccountErasureResult> {
    // Collected before anything is deleted: these rows cascade away with the
    // children and the keys are unrecoverable afterwards.
    const childrenResult = await this.pool.query(`SELECT id FROM children WHERE user_id = $1`, [userId]);
    const childIds = childrenResult.rows.map((r) => r.id as string);
    const storageKeys: string[] = [];
    for (const childId of childIds) {
      storageKeys.push(...(await this.collectChildStorageKeys(userId, childId)));
    }

    // One transaction on one connection: "erase this account" is a single
    // operation to the person who asked for it, so a crash halfway through
    // must not leave a half-erased account that no code models — and that
    // the caller would still be told succeeded.
    const client = await this.pool.connect();
    let childrenDeleted = 0;
    try {
      await client.query('BEGIN');

      // Assessments block ChildService's normal delete path on purpose; an
      // erasure request overrides that by clearing them first.
      await client.query(`DELETE FROM sensory_assessments WHERE user_id = $1`, [userId]);
      const deleteChildrenResult = await client.query(`DELETE FROM children WHERE user_id = $1`, [userId]);
      childrenDeleted = deleteChildrenResult.rowCount ?? 0;

      for (const sql of ACCOUNT_SCOPED_DELETES) {
        await client.query(sql, [userId]);
      }

      // Not a delete: the row belongs to whoever invited this user as a
      // professional, so it stays — but it must stop pointing at them.
      await client.query(`UPDATE professionals SET accepted_user_id = NULL WHERE accepted_user_id = $1`, [userId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // After the commit, deliberately: if the DB work fails we want the files
    // still there, not deleted out from under rows that survived.
    const storageObjectsDeleted = await this.deleteStorageKeys(storageKeys);

    return { childrenDeleted, storageObjectsDeleted };
  }
}
