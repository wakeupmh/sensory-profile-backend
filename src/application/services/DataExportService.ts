import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import { S3StorageService, DOWNLOAD_URL_TTL_SECONDS } from '../../infrastructure/storage/S3StorageService';

export interface DataExportResult {
  downloadUrl: string;
  expiresAt: string;
}

/**
 * LGPD Art. 18 §1 (portabilidade) — hands the data subject a full dump of
 * everything the app holds about them (or about one specific child), as a
 * JSON file. Read-only, raw `SELECT *` per table rather than a curated
 * shape: completeness matters more than presentation here, and it avoids
 * this file silently going stale as columns are added elsewhere.
 *
 * The file is generated in memory, uploaded to S3 under a private
 * `exports/` prefix, and handed back as a short-lived presigned URL — the
 * same pattern documents already use, just server-generated instead of
 * client-uploaded. Nothing is left around longer than necessary: the
 * object still needs an S3 lifecycle rule to expire old exports (see
 * README), since this service only writes, it doesn't schedule cleanup.
 */
/**
 * Every table tied to one child, keyed by the name it gets in the exported
 * JSON. All of them take exactly `[userId, childId]`, which is what lets
 * this be a flat name→SQL record instead of a positional array.
 *
 * That shape is deliberate: the previous version destructured an 18-element
 * `Promise.all` into 18 names and then rebuilt an object from them, so
 * inserting a query in the middle without inserting its name at the same
 * index would have silently relabelled every table below it — shipping one
 * table's rows under another table's name, in a document whose entire
 * purpose is to tell someone accurately what is held about them. Here the
 * name and its query are the same line and cannot drift apart.
 */
const CHILD_LINKED_QUERIES = {
  assessments: `SELECT * FROM sensory_assessments WHERE user_id = $1 AND child_id = $2 ORDER BY assessment_date`,
  // As respostas item a item são o dado clínico central da avaliação — sem
  // elas a exportação teria o cabeçalho e não o conteúdo.
  assessmentResponses: `SELECT sr.* FROM sensory_responses sr JOIN sensory_assessments sa ON sa.id = sr.assessment_id
     WHERE sa.user_id = $1 AND sa.child_id = $2 ORDER BY sr.created_at`,
  assessmentSectionComments: `SELECT sc.* FROM section_comments sc JOIN sensory_assessments sa ON sa.id = sc.assessment_id
     WHERE sa.user_id = $1 AND sa.child_id = $2 ORDER BY sc.created_at`,
  dailyLogs: `SELECT * FROM daily_logs WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`,
  // As chaves de S3 (áudio/transcrição) ficam de fora: são referências
  // internas de armazenamento, não conteúdo do titular, e não abrem nada
  // sem uma URL assinada.
  dailyReports: `SELECT id, child_id, report_date, status, transcript, structured, error, created_at, updated_at
     FROM daily_reports WHERE user_id = $1 AND child_id = $2 ORDER BY report_date`,
  logAttachments: `SELECT la.* FROM log_attachments la JOIN daily_logs dl ON dl.id = la.log_id
     WHERE dl.user_id = $1 AND dl.child_id = $2 ORDER BY la.created_at`,
  therapySessions: `SELECT * FROM therapy_sessions WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`,
  therapists: `SELECT DISTINCT t.* FROM therapists t JOIN therapy_sessions ts ON ts.therapist_id = t.id
     WHERE t.user_id = $1 AND ts.child_id = $2`,
  medications: `SELECT * FROM medications WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  comorbidities: `SELECT * FROM comorbidities WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  medicalAppointments: `SELECT * FROM medical_appointments WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`,
  developmentalMilestones: `SELECT * FROM developmental_milestones WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  communicationLogs: `SELECT * FROM communication_logs WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`,
  educationPlans: `SELECT * FROM education_plans WHERE user_id = $1 AND child_id = $2 ORDER BY start_date`,
  schoolCommunications: `SELECT * FROM school_communications WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`,
  goals: `SELECT * FROM goals WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  goalProgressEntries: `SELECT gpe.* FROM goal_progress_entries gpe JOIN goals g ON g.id = gpe.goal_id
     WHERE g.user_id = $1 AND g.child_id = $2 ORDER BY gpe.created_at`,
  documents: `SELECT * FROM documents WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  aiSummaries: `SELECT * FROM ai_summaries WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  professionalNotes: `SELECT * FROM professional_notes WHERE author_user_id = $1 AND child_id = $2 ORDER BY created_at`,
  accessLogs: `SELECT * FROM access_logs WHERE actor_user_id = $1 AND child_id = $2 ORDER BY created_at`,
  reminders: `SELECT * FROM reminders WHERE user_id = $1 AND child_id = $2 ORDER BY due_at`,
  reportShares: `SELECT * FROM report_shares WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`,
  childShares: `SELECT * FROM child_shares WHERE granted_by_user_id = $1 AND child_id = $2 ORDER BY created_at`,
} as const;

/** Tabelas do usuário que não pendem de nenhuma criança. Todas usam `[userId]`. */
const ACCOUNT_LEVEL_QUERIES = {
  userProfile: `SELECT * FROM user_profiles WHERE user_id = $1`,
  anamneses: `SELECT * FROM anamneses WHERE user_id = $1 ORDER BY created_at`,
  professionals: `SELECT * FROM professionals WHERE owner_user_id = $1 ORDER BY created_at`,
  formDrafts: `SELECT * FROM form_drafts WHERE user_id = $1 ORDER BY updated_at`,
  reminderNotifications: `SELECT * FROM reminder_notifications WHERE user_id = $1 ORDER BY sent_at`,
  caregiverSharesGranted: `SELECT * FROM caregiver_shares WHERE owner_user_id = $1 ORDER BY created_at`,
  caregiverSharesReceived: `SELECT * FROM caregiver_shares WHERE caregiver_user_id = $1 ORDER BY created_at`,
  // Contatos e inscrições que não têm child_id — sem isto a exportação
  // "completa" omitiria terapeutas sem sessão registrada, por exemplo.
  therapists: `SELECT * FROM therapists WHERE user_id = $1 ORDER BY created_at`,
  examiners: `SELECT * FROM examiners WHERE user_id = $1`,
  caregivers: `SELECT * FROM caregivers WHERE user_id = $1`,
  pushSubscriptions: `SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at`,
} as const;

export class DataExportService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: S3StorageService,
  ) {}

  async exportChild(userId: string, childId: string): Promise<DataExportResult> {
    const childResult = await this.pool.query(`SELECT * FROM children WHERE id = $1 AND user_id = $2`, [childId, userId]);
    if (childResult.rows.length === 0) {
      throw new NotFoundError('Child', childId);
    }

    const data = {
      exportedAt: new Date().toISOString(),
      scope: 'child' as const,
      child: childResult.rows[0],
      ...(await this.gatherChildLinkedTables(userId, childId)),
    };

    return this.upload(userId, `child-${childId}`, data);
  }

  async exportAccount(userId: string): Promise<DataExportResult> {
    const childrenResult = await this.pool.query(`SELECT * FROM children WHERE user_id = $1 ORDER BY created_at`, [userId]);

    // One child at a time, deliberately. Fanning every child out in parallel
    // would put (children x 23) queries on a pool of 10 at once; node-pg's
    // connectionTimeoutMillis covers queue wait, so one big export could make
    // unrelated requests fail rather than merely wait. An export is not
    // latency-sensitive — nobody is watching a spinner for it.
    const children = [];
    for (const child of childrenResult.rows) {
      children.push({ child, ...(await this.gatherChildLinkedTables(userId, child.id as string)) });
    }

    const entries = Object.entries(ACCOUNT_LEVEL_QUERIES);
    const results = await Promise.all(entries.map(([, sql]) => this.pool.query(sql, [userId])));
    const accountLevel = Object.fromEntries(entries.map(([name], i) => [name, results[i].rows]));

    const data = {
      exportedAt: new Date().toISOString(),
      scope: 'account' as const,
      ...accountLevel,
      // user_profiles has at most one row per user; unwrap it so the export
      // doesn't hand someone a one-element array to puzzle over.
      userProfile: (accountLevel.userProfile as unknown[])[0] ?? null,
      children,
    };

    return this.upload(userId, 'account', data);
  }

  private async gatherChildLinkedTables(userId: string, childId: string) {
    const entries = Object.entries(CHILD_LINKED_QUERIES);
    const results = await Promise.all(entries.map(([, sql]) => this.pool.query(sql, [userId, childId])));
    return Object.fromEntries(entries.map(([name], i) => [name, results[i].rows])) as Record<
      keyof typeof CHILD_LINKED_QUERIES,
      unknown[]
    >;
  }

  private async upload(userId: string, label: string, data: unknown): Promise<DataExportResult> {
    const key = `exports/${userId}/${label}-${Date.now()}-${randomUUID()}.json`;
    const body = JSON.stringify(data, null, 2);
    await this.storage.putObject(key, body, 'application/json');
    const downloadUrl = await this.storage.getDownloadUrl(key);
    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString();
    return { downloadUrl, expiresAt };
  }
}
