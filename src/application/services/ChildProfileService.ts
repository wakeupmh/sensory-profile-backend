import { Pool } from 'pg';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import { formatDateString } from '../../infrastructure/utils/date';

export interface ChildProfileStats {
  assessmentCount: number;
  logCount: number;
  therapySessionCount: number;
  activeMedicationCount: number;
  achievedMilestoneCount: number;
  educationPlanCount: number;
}

export interface ChildProfileResult {
  child: {
    id: string;
    name: string;
    birthDate: string | null;
    gender: string | null;
    nationalIdentity: string | null;
    notes: string | null;
    createdAt: string;
  };
  stats: ChildProfileStats;
}

export interface TimelineEvent {
  id: string;
  type: 'assessment' | 'log' | 'therapy' | 'medical_appointment' | 'communication' | 'school_comm' | 'milestone';
  occurredAt: string;
  title: string;
  subtitle: string | null;
}

export interface PaginatedTimeline {
  data: TimelineEvent[];
  total: number;
  page: number;
  limit: number;
}

export class ChildProfileService {
  constructor(private readonly pool: Pool) {}

  async verifyChildOwnership(childId: string, userId: string): Promise<{ id: string; name: string; birth_date: string | null; gender: string | null; national_identity: string | null; notes: string | null; created_at: Date }> {
    const result = await this.pool.query(
      `SELECT id, name, birth_date, gender, national_identity, notes, created_at FROM children WHERE id = $1 AND user_id = $2`,
      [childId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('Child not found');
    }
    return result.rows[0] as { id: string; name: string; birth_date: string | null; gender: string | null; national_identity: string | null; notes: string | null; created_at: Date };
  }

  async getProfile(childId: string, userId: string, periodDays: number = 30): Promise<ChildProfileResult> {
    const childRow = await this.verifyChildOwnership(childId, userId);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const [
      assessmentResult,
      logResult,
      therapyResult,
      medicationResult,
      milestoneResult,
      educationResult,
    ] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM sensory_assessments WHERE user_id = $1 AND child_id = $2`,
        [userId, childId],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM daily_logs WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM therapy_sessions WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM medications WHERE user_id = $1 AND child_id = $2 AND active = true`,
        [userId, childId],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM developmental_milestones WHERE user_id = $1 AND child_id = $2 AND status = 'achieved'`,
        [userId, childId],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM education_plans WHERE user_id = $1 AND child_id = $2`,
        [userId, childId],
      ),
    ]);

    return {
      child: {
        id: childRow.id,
        name: childRow.name,
        birthDate: formatDateString(childRow.birth_date),
        gender: childRow.gender,
        nationalIdentity: childRow.national_identity,
        notes: childRow.notes,
        createdAt: childRow.created_at.toISOString(),
      },
      stats: {
        assessmentCount: Number(assessmentResult.rows[0]?.cnt ?? 0),
        logCount: Number(logResult.rows[0]?.cnt ?? 0),
        therapySessionCount: Number(therapyResult.rows[0]?.cnt ?? 0),
        activeMedicationCount: Number(medicationResult.rows[0]?.cnt ?? 0),
        achievedMilestoneCount: Number(milestoneResult.rows[0]?.cnt ?? 0),
        educationPlanCount: Number(educationResult.rows[0]?.cnt ?? 0),
      },
    };
  }

  async getTimeline(
    childId: string,
    userId: string,
    page: number,
    limit: number,
    from?: string,
    to?: string,
  ): Promise<PaginatedTimeline> {
    // Verify ownership first
    await this.verifyChildOwnership(childId, userId);

    const offset = (page - 1) * limit;
    const fromVal = from ? from : null;
    const toVal = to ? to : null;

    const unionCte = `
        SELECT id::text, 'assessment'::text AS type, assessment_date AS occurred_at,
               instrument_id AS title, NULL::text AS subtitle
        FROM sensory_assessments
        WHERE user_id = $1 AND child_id = $2 AND assessment_date IS NOT NULL

        UNION ALL

        SELECT id::text, 'log'::text, occurred_at, log_type, notes
        FROM daily_logs
        WHERE user_id = $1 AND child_id = $2

        UNION ALL

        SELECT ts.id::text, 'therapy'::text, ts.occurred_at, ts.therapy_type, t.name
        FROM therapy_sessions ts
        LEFT JOIN therapists t ON ts.therapist_id = t.id
        WHERE ts.user_id = $1 AND ts.child_id = $2

        UNION ALL

        SELECT id::text, 'medical_appointment'::text, occurred_at, specialty, NULL::text
        FROM medical_appointments
        WHERE user_id = $1 AND child_id = $2

        UNION ALL

        SELECT id::text, 'communication'::text, occurred_at, entry_type, description
        FROM communication_logs
        WHERE user_id = $1 AND child_id = $2

        UNION ALL

        SELECT id::text, 'school_comm'::text, occurred_at, comm_type, subject
        FROM school_communications
        WHERE user_id = $1 AND child_id = $2

        UNION ALL

        SELECT id::text, 'milestone'::text, achieved_date::timestamptz, title, category
        FROM developmental_milestones
        WHERE user_id = $1 AND child_id = $2 AND status = 'achieved' AND achieved_date IS NOT NULL
    `;

    const dataSql = `
      WITH timeline_raw AS (${unionCte})
      SELECT *
      FROM timeline_raw
      WHERE ($3::timestamptz IS NULL OR occurred_at >= $3)
        AND ($4::timestamptz IS NULL OR occurred_at <= $4)
      ORDER BY occurred_at DESC
      LIMIT $5 OFFSET $6
    `;

    const countSql = `
      WITH timeline_raw AS (
        SELECT 1 AS _one, occurred_at
        FROM (${unionCte}) _u
      )
      SELECT COUNT(*)::int AS total_count
      FROM timeline_raw
      WHERE ($3::timestamptz IS NULL OR occurred_at >= $3)
        AND ($4::timestamptz IS NULL OR occurred_at <= $4)
    `;

    const params = [userId, childId, fromVal, toVal, limit, offset];
    const countParams = [userId, childId, fromVal, toVal];

    const [result, countResult] = await Promise.all([
      this.pool.query(dataSql, params),
      this.pool.query(countSql, countParams),
    ]);

    const total = Number(countResult.rows[0]?.total_count ?? 0);

    const data: TimelineEvent[] = result.rows.map(row => {
      const rawDate = row.occurred_at;
      let occurredAt: string;
      if (rawDate instanceof Date) {
        occurredAt = rawDate.toISOString();
      } else if (typeof rawDate === 'string') {
        occurredAt = new Date(rawDate).toISOString();
      } else {
        // pg returns Date objects; fallback for unexpected types
        occurredAt = String(rawDate);
      }
      return {
        id: row.id as string,
        type: row.type as TimelineEvent['type'],
        occurredAt,
        title: row.title as string,
        subtitle: row.subtitle as string | null,
      };
    });

    return { data, total, page, limit };
  }
}
