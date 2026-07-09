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
    const childrenResult = await this.pool.query(`SELECT id FROM children WHERE user_id = $1`, [userId]);
    const childIds = childrenResult.rows.map((r) => r.id as string);

    const storageKeys = (
      await Promise.all(childIds.map((childId) => this.collectChildStorageKeys(userId, childId)))
    ).flat();

    // Assessments block ChildService's normal delete path on purpose; an
    // erasure request overrides that by clearing them first.
    await this.pool.query(`DELETE FROM sensory_assessments WHERE user_id = $1`, [userId]);
    const deleteChildrenResult = await this.pool.query(`DELETE FROM children WHERE user_id = $1`, [userId]);

    await Promise.all([
      this.pool.query(`DELETE FROM anamneses WHERE user_id = $1`, [userId]),
      this.pool.query(`DELETE FROM professionals WHERE owner_user_id = $1`, [userId]),
      this.pool.query(`DELETE FROM form_drafts WHERE user_id = $1`, [userId]),
      this.pool.query(`DELETE FROM reminder_notifications WHERE user_id = $1`, [userId]),
      this.pool.query(`DELETE FROM caregiver_shares WHERE caregiver_user_id = $1`, [userId]),
      this.pool.query(`DELETE FROM user_profiles WHERE user_id = $1`, [userId]),
    ]);

    const storageObjectsDeleted = await this.deleteStorageKeys(storageKeys);

    return {
      childrenDeleted: deleteChildrenResult.rowCount ?? 0,
      storageObjectsDeleted,
    };
  }
}
