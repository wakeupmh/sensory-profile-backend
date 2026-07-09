import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';

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
    const children = await Promise.all(
      childrenResult.rows.map(async (child) => ({
        child,
        ...(await this.gatherChildLinkedTables(userId, child.id as string)),
      })),
    );

    const [
      userProfileResult,
      anamnesesResult,
      professionalsResult,
      formDraftsResult,
      reminderNotificationsResult,
      caregiverSharesAsOwnerResult,
      caregiverSharesAsCaregiverResult,
    ] = await Promise.all([
      this.pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]),
      this.pool.query(`SELECT * FROM anamneses WHERE user_id = $1 ORDER BY created_at`, [userId]),
      this.pool.query(`SELECT * FROM professionals WHERE owner_user_id = $1 ORDER BY created_at`, [userId]),
      this.pool.query(`SELECT * FROM form_drafts WHERE user_id = $1 ORDER BY updated_at`, [userId]),
      this.pool.query(`SELECT * FROM reminder_notifications WHERE user_id = $1 ORDER BY sent_at`, [userId]),
      this.pool.query(`SELECT * FROM caregiver_shares WHERE owner_user_id = $1 ORDER BY created_at`, [userId]),
      this.pool.query(`SELECT * FROM caregiver_shares WHERE caregiver_user_id = $1 ORDER BY created_at`, [userId]),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      scope: 'account' as const,
      userProfile: userProfileResult.rows[0] ?? null,
      children,
      anamneses: anamnesesResult.rows,
      professionals: professionalsResult.rows,
      formDrafts: formDraftsResult.rows,
      reminderNotifications: reminderNotificationsResult.rows,
      caregiverSharesGranted: caregiverSharesAsOwnerResult.rows,
      caregiverSharesReceived: caregiverSharesAsCaregiverResult.rows,
    };

    return this.upload(userId, 'account', data);
  }

  private async gatherChildLinkedTables(userId: string, childId: string) {
    const [
      assessments,
      dailyLogs,
      logAttachments,
      therapySessions,
      therapists,
      medications,
      comorbidities,
      medicalAppointments,
      developmentalMilestones,
      communicationLogs,
      educationPlans,
      schoolCommunications,
      goals,
      goalProgressEntries,
      documents,
      aiSummaries,
      professionalNotes,
      accessLogs,
    ] = await Promise.all([
      this.pool.query(`SELECT * FROM sensory_assessments WHERE user_id = $1 AND child_id = $2 ORDER BY assessment_date`, [userId, childId]),
      this.pool.query(`SELECT * FROM daily_logs WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`, [userId, childId]),
      this.pool.query(
        `SELECT la.* FROM log_attachments la JOIN daily_logs dl ON dl.id = la.log_id WHERE dl.user_id = $1 AND dl.child_id = $2 ORDER BY la.created_at`,
        [userId, childId],
      ),
      this.pool.query(`SELECT * FROM therapy_sessions WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`, [userId, childId]),
      this.pool.query(
        `SELECT DISTINCT t.* FROM therapists t JOIN therapy_sessions ts ON ts.therapist_id = t.id WHERE t.user_id = $1 AND ts.child_id = $2`,
        [userId, childId],
      ),
      this.pool.query(`SELECT * FROM medications WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM comorbidities WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM medical_appointments WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM developmental_milestones WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM communication_logs WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM education_plans WHERE user_id = $1 AND child_id = $2 ORDER BY start_date`, [userId, childId]),
      this.pool.query(`SELECT * FROM school_communications WHERE user_id = $1 AND child_id = $2 ORDER BY occurred_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM goals WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(
        `SELECT gpe.* FROM goal_progress_entries gpe JOIN goals g ON g.id = gpe.goal_id WHERE g.user_id = $1 AND g.child_id = $2 ORDER BY gpe.created_at`,
        [userId, childId],
      ),
      this.pool.query(`SELECT * FROM documents WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM ai_summaries WHERE user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM professional_notes WHERE author_user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
      this.pool.query(`SELECT * FROM access_logs WHERE actor_user_id = $1 AND child_id = $2 ORDER BY created_at`, [userId, childId]),
    ]);

    return {
      assessments: assessments.rows,
      dailyLogs: dailyLogs.rows,
      logAttachments: logAttachments.rows,
      therapySessions: therapySessions.rows,
      therapists: therapists.rows,
      medications: medications.rows,
      comorbidities: comorbidities.rows,
      medicalAppointments: medicalAppointments.rows,
      developmentalMilestones: developmentalMilestones.rows,
      communicationLogs: communicationLogs.rows,
      educationPlans: educationPlans.rows,
      schoolCommunications: schoolCommunications.rows,
      goals: goals.rows,
      goalProgressEntries: goalProgressEntries.rows,
      documents: documents.rows,
      aiSummaries: aiSummaries.rows,
      professionalNotes: professionalNotes.rows,
      accessLogs: accessLogs.rows,
    };
  }

  private async upload(userId: string, label: string, data: unknown): Promise<DataExportResult> {
    const key = `exports/${userId}/${label}-${Date.now()}-${randomUUID()}.json`;
    const body = JSON.stringify(data, null, 2);
    await this.storage.putObject(key, body, 'application/json');
    const downloadUrl = await this.storage.getDownloadUrl(key);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return { downloadUrl, expiresAt };
  }
}
