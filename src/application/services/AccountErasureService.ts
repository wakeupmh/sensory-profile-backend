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
  // Ditados avulsos: o áudio normalmente já foi descartado na transcrição,
  // mas a transcrição em si é fala do usuário e não tem child_id.
  `DELETE FROM voice_notes WHERE user_id = $1`,
  // Por último: as tabelas acima podem ser lidas por triggers/FKs antes disto.
  `DELETE FROM user_profiles WHERE user_id = $1`,
] as const;

/**
 * Tabelas clínicas com `author_user_id` opcional (migration 036) — quem de
 * fato escreveu a linha, quando é alguém além do dono (um profissional
 * escrevendo sob concessão do care team). Exportada para que
 * `accountErasureCoverage.int.test.ts` monte a MESMA lista em vez de manter
 * uma cópia paralela que pode divergir desta.
 *
 * O buraco que esta lista fecha: os DELETEs acima e o cascade de `children`
 * só alcançam linhas de quem está apagando a PRÓPRIA conta — e um
 * profissional não é dono de nenhuma das crianças em que escreveu sob
 * concessão. Sem isto, o `sub` do Supabase de quem pediu a eliminação (LGPD
 * Art. 18 VI) ficava para sempre gravado no prontuário de famílias que ele
 * nunca foi dono. O registro clínico em si FICA — pertence à família, que
 * não pediu para apagá-lo — só a autoria é neutralizada.
 *
 * `professional_notes` também tem `author_user_id`, mas NOT NULL desde a
 * migration 024 — lá a coluna É A RAZÃO DE SER da linha (uma nota sem autor
 * não é uma nota), então zerá-la violaria a constraint em vez de neutralizar
 * algo. Fica de fora desta lista de propósito: é o mesmo buraco de LGPD, só
 * que decidir apagar a nota ou afrouxar a constraint é uma decisão que esta
 * fase do care team não toma sozinha. Ver o comentário em
 * `accountErasureCoverage.int.test.ts` — o buraco fica registrado como
 * conhecido, não esquecido.
 */
export const AUTHOR_ATTRIBUTED_TABLES = [
  'communication_logs',
  'comorbidities',
  'daily_logs',
  'daily_reports',
  'developmental_milestones',
  'documents',
  'education_plans',
  'goals',
  'goal_progress_entries',
  'medical_appointments',
  'medications',
  'reminders',
  'school_communications',
  'therapy_sessions',
] as const;

export class AccountErasureService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService,
  ) {}

  async collectChildStorageKeys(userId: string, childId: string): Promise<string[]> {
    const [documentsResult, attachmentsResult, dailyReportsResult] = await Promise.all([
      this.pool.query(`SELECT storage_key FROM documents WHERE user_id = $1 AND child_id = $2`, [userId, childId]),
      this.pool.query(
        `SELECT la.storage_key FROM log_attachments la
         JOIN daily_logs dl ON dl.id = la.log_id
         WHERE dl.user_id = $1 AND dl.child_id = $2`,
        [userId, childId],
      ),
      // Two keys per row (the recording and the transcript JSON the
      // Transcribe job wrote), either of which may be NULL depending on how
      // far the report got before it was abandoned.
      this.pool.query(
        `SELECT audio_storage_key, transcript_key FROM daily_reports WHERE user_id = $1 AND child_id = $2`,
        [userId, childId],
      ),
    ]);
    return [
      ...documentsResult.rows.map((r) => r.storage_key as string),
      ...attachmentsResult.rows.map((r) => r.storage_key as string),
      ...dailyReportsResult.rows.flatMap((r) =>
        [r.audio_storage_key as string | null, r.transcript_key as string | null].filter(
          (k): k is string => k !== null,
        ),
      ),
    ];
  }

  async deleteStorageKeys(keys: string[]): Promise<number> {
    const results = await Promise.allSettled(keys.map((key) => this.storage.deleteObject(key)));
    return results.filter((r) => r.status === 'fulfilled').length;
  }

  /**
   * Chaves de S3 que pendem da conta, não de uma criança: hoje só os ditados
   * avulsos abandonados (um `draft` cujo upload nunca virou transcrição, ou um
   * descarte que falhou). Como as outras, precisa rodar antes do DELETE.
   */
  async collectAccountStorageKeys(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      `SELECT audio_storage_key, transcript_key FROM voice_notes WHERE user_id = $1`,
      [userId],
    );
    return rows.flatMap((r) =>
      [r.audio_storage_key as string | null, r.transcript_key as string | null].filter(
        (k): k is string => k !== null,
      ),
    );
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
    storageKeys.push(...(await this.collectAccountStorageKeys(userId)));

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

      // Autoria em dados de OUTRAS famílias — ver o comentário de
      // AUTHOR_ATTRIBUTED_TABLES acima para o porquê. Cada UPDATE só toca
      // linhas onde este usuário é o AUTOR, nunca o dono (essas já foram
      // apagadas pelos DELETEs/cascade acima), então não há como isto
      // remover autoria de quem não deveria.
      for (const table of AUTHOR_ATTRIBUTED_TABLES) {
        await client.query(`UPDATE ${table} SET author_user_id = NULL WHERE author_user_id = $1`, [userId]);
      }

      // A existência da tabela é checada em tempo de execução em vez de
      // assumida: a eliminação de conta não pode falhar num ambiente que
      // ainda não aplicou a migration 035. Sem a tabela, o passo é pulado.
      //
      // Não é DELETE: a linha é do RESPONSÁVEL que concedeu o acesso (é ele
      // quem tem o histórico de "quem já atendeu esta criança"), não do
      // profissional que aceitou — mesmo raciocínio do UPDATE em
      // `professionals` acima. `member_user_id` é zerado para não deixar o
      // `sub` de quem pediu a eliminação preso à concessão de outra família,
      // e `revoked_at` é marcado (se ainda não estava) porque uma conta
      // apagada não pode continuar contando como participação ativa na
      // equipe de cuidado — a revogação já era soft por design (ver
      // CONTRACT.md), então isto só antecipa o que aconteceria de qualquer
      // forma.
      const careTeamTableExists = await client.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'care_team_members'`,
      );
      if (careTeamTableExists.rows.length > 0) {
        await client.query(
          `UPDATE care_team_members
              SET member_user_id = NULL, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
            WHERE member_user_id = $1`,
          [userId],
        );
      }

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
