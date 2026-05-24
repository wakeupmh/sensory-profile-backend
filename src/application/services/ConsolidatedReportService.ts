import { Pool } from 'pg';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface ConsolidatedSummary {
  child: { id: string; name: string; birthDate: string | null; notes: string | null };
  generatedAt: string;
  period: { from: string; to: string };
  assessments: {
    recent: Array<{ id: string; instrumentId: string; completedAt: string | null; scoresJson: Record<string, unknown> | null }>;
    count: number;
  };
  logs: {
    byType: Record<string, number>;
    totalCount: number;
  };
  therapy: {
    activeTherapists: Array<{ id: string; name: string; specialty: string }>;
    recentSessions: Array<{ id: string; therapyType: string; occurredAt: string; durationMinutes: number | null; therapistName: string | null }>;
    sessionCount: number;
    byType: Record<string, number>;
  };
  medical: {
    activeMedications: Array<{ id: string; name: string; dosage: string | null; frequency: string | null; startDate: string | null }>;
    comorbidities: Array<{ id: string; conditionName: string; icdCode: string | null }>;
    recentAppointments: Array<{ id: string; specialty: string; occurredAt: string; followUpDate: string | null }>;
  };
  development: {
    milestoneStats: { achieved: number; inProgress: number; notYet: number; regressed: number };
    recentCommunicationLogs: Array<{ id: string; entryType: string; occurredAt: string; wordsCount: number | null; description: string | null }>;
  };
  education: {
    plans: Array<{ id: string; schoolName: string; planType: string; academicYear: string; startDate: string }>;
    recentComms: Array<{ id: string; commType: string; subject: string; occurredAt: string }>;
  };
}

export class ConsolidatedReportService {
  constructor(private readonly pool: Pool) {}

  async getSummary(userId: string, childId: string, periodDays: number = 90): Promise<ConsolidatedSummary> {
    // Verify child ownership
    const childResult = await this.pool.query(
      `SELECT id, name, birth_date, notes FROM children WHERE id = $1 AND user_id = $2`,
      [childId, userId],
    );
    if (childResult.rows.length === 0) {
      throw new NotFoundError('Child not found');
    }
    const child = childResult.rows[0] as { id: string; name: string; birth_date: Date | string | null; notes: string | null };

    const now = new Date();
    const from = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const to = now;

    const [
      assessmentRows,
      logRows,
      sessionRows,
      therapistRows,
      medicationRows,
      comorbidityRows,
      appointmentRows,
      milestoneRows,
      commLogRows,
      educationPlanRows,
      schoolCommRows,
    ] = await Promise.all([
      // assessments
      this.pool.query(`
        SELECT id, instrument_id, assessment_date AS completed_at, scores_json,
               CASE WHEN scores_json IS NULL THEN
                 (SELECT json_object_agg(section_name, section_score)
                  FROM (
                    SELECT unnest(ARRAY['auditivo','visual','tato','movimento','posicao_corporal','oral','conduta','socio_emocional','atencao'])::text AS section_name,
                           unnest(ARRAY[auditory_processing_raw_score,visual_processing_raw_score,tactile_processing_raw_score,movement_processing_raw_score,body_position_processing_raw_score,oral_sensitivity_processing_raw_score,behavioral_responses_raw_score,social_emotional_responses_raw_score,attention_responses_raw_score]) AS section_score
                  ) s
               ) END AS legacy_scores
        FROM sensory_assessments
        WHERE user_id = $1 AND child_id = $2
        ORDER BY assessment_date DESC NULLS LAST
        LIMIT 5
      `, [userId, childId]),

      // daily_logs
      this.pool.query(`
        SELECT log_type, COUNT(*) as cnt
        FROM daily_logs
        WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3
        GROUP BY log_type
      `, [userId, childId, from.toISOString()]),

      // therapy_sessions
      this.pool.query(`
        SELECT ts.id, ts.therapy_type, ts.occurred_at, ts.duration_minutes, t.name as therapist_name
        FROM therapy_sessions ts
        LEFT JOIN therapists t ON ts.therapist_id = t.id
        WHERE ts.user_id = $1 AND ts.child_id = $2 AND ts.occurred_at >= $3
        ORDER BY ts.occurred_at DESC
        LIMIT 10
      `, [userId, childId, from.toISOString()]),

      // therapists (active = any session in the period)
      this.pool.query(`
        SELECT DISTINCT t.id, t.name, t.specialty
        FROM therapists t
        JOIN therapy_sessions ts ON ts.therapist_id = t.id
        WHERE t.user_id = $1 AND ts.child_id = $2 AND ts.occurred_at >= $3
      `, [userId, childId, from.toISOString()]),

      // medications
      this.pool.query(`
        SELECT id, name, dosage, frequency, start_date
        FROM medications
        WHERE user_id = $1 AND child_id = $2 AND active = true
        ORDER BY created_at DESC
      `, [userId, childId]),

      // comorbidities
      this.pool.query(`
        SELECT id, condition_name, icd_code, diagnosis_date
        FROM comorbidities
        WHERE user_id = $1 AND child_id = $2
        ORDER BY diagnosis_date DESC NULLS LAST
      `, [userId, childId]),

      // medical_appointments
      this.pool.query(`
        SELECT id, specialty, occurred_at, follow_up_date, notes
        FROM medical_appointments
        WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3
        ORDER BY occurred_at DESC
        LIMIT 5
      `, [userId, childId, from.toISOString()]),

      // developmental_milestones
      this.pool.query(`
        SELECT status, COUNT(*) as cnt
        FROM developmental_milestones
        WHERE user_id = $1 AND child_id = $2
        GROUP BY status
      `, [userId, childId]),

      // communication_logs
      this.pool.query(`
        SELECT id, entry_type, occurred_at, words_count, description
        FROM communication_logs
        WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3
        ORDER BY occurred_at DESC
        LIMIT 5
      `, [userId, childId, from.toISOString()]),

      // education_plans
      this.pool.query(`
        SELECT id, school_name, plan_type, academic_year, start_date, review_date
        FROM education_plans
        WHERE user_id = $1 AND child_id = $2
        ORDER BY start_date DESC
        LIMIT 5
      `, [userId, childId]),

      // school_communications
      this.pool.query(`
        SELECT id, comm_type, subject, occurred_at, attendees
        FROM school_communications
        WHERE user_id = $1 AND child_id = $2 AND occurred_at >= $3
        ORDER BY occurred_at DESC
        LIMIT 5
      `, [userId, childId, from.toISOString()]),
    ]);

    // Build logs.byType
    const logsByType: Record<string, number> = {};
    for (const row of logRows.rows) {
      logsByType[row.log_type as string] = parseInt(row.cnt as string, 10);
    }
    const totalLogs = Object.values(logsByType).reduce((a, b) => a + b, 0);

    // Build therapy.byType
    const therapyByType: Record<string, number> = {};
    for (const row of sessionRows.rows) {
      const t = row.therapy_type as string;
      therapyByType[t] = (therapyByType[t] ?? 0) + 1;
    }

    // Build milestone stats
    const milestoneStats = { achieved: 0, inProgress: 0, notYet: 0, regressed: 0 };
    for (const row of milestoneRows.rows) {
      const cnt = parseInt(row.cnt as string, 10);
      const status = row.status as string;
      if (status === 'achieved') milestoneStats.achieved = cnt;
      else if (status === 'in_progress') milestoneStats.inProgress = cnt;
      else if (status === 'not_yet') milestoneStats.notYet = cnt;
      else if (status === 'regressed') milestoneStats.regressed = cnt;
    }

    const birthDateOut = child.birth_date == null
      ? null
      : (child.birth_date instanceof Date ? child.birth_date.toISOString().slice(0, 10) : String(child.birth_date));

    return {
      child: { id: child.id, name: child.name, birthDate: birthDateOut, notes: child.notes },
      generatedAt: now.toISOString(),
      period: { from: from.toISOString(), to: to.toISOString() },
      assessments: {
        recent: assessmentRows.rows.map((row) => ({
          id: row.id as string,
          instrumentId: row.instrument_id as string,
          completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
          scoresJson: (row.scores_json ?? row.legacy_scores ?? null) as Record<string, unknown> | null,
        })),
        count: assessmentRows.rows.length,
      },
      logs: {
        byType: logsByType,
        totalCount: totalLogs,
      },
      therapy: {
        activeTherapists: therapistRows.rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          specialty: row.specialty as string,
        })),
        recentSessions: sessionRows.rows.map((row) => ({
          id: row.id as string,
          therapyType: row.therapy_type as string,
          occurredAt: (row.occurred_at as Date).toISOString(),
          durationMinutes: row.duration_minutes != null ? parseInt(row.duration_minutes as string, 10) : null,
          therapistName: row.therapist_name as string | null,
        })),
        sessionCount: sessionRows.rows.length,
        byType: therapyByType,
      },
      medical: {
        activeMedications: medicationRows.rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          dosage: row.dosage as string | null,
          frequency: row.frequency as string | null,
          startDate: row.start_date as string | null,
        })),
        comorbidities: comorbidityRows.rows.map((row) => ({
          id: row.id as string,
          conditionName: row.condition_name as string,
          icdCode: row.icd_code as string | null,
        })),
        recentAppointments: appointmentRows.rows.map((row) => ({
          id: row.id as string,
          specialty: row.specialty as string,
          occurredAt: (row.occurred_at as Date).toISOString(),
          followUpDate: row.follow_up_date as string | null,
        })),
      },
      development: {
        milestoneStats,
        recentCommunicationLogs: commLogRows.rows.map((row) => ({
          id: row.id as string,
          entryType: row.entry_type as string,
          occurredAt: (row.occurred_at as Date).toISOString(),
          wordsCount: row.words_count != null ? parseInt(row.words_count as string, 10) : null,
          description: row.description as string | null,
        })),
      },
      education: {
        plans: educationPlanRows.rows.map((row) => ({
          id: row.id as string,
          schoolName: row.school_name as string,
          planType: row.plan_type as string,
          academicYear: row.academic_year as string,
          startDate: row.start_date as string,
        })),
        recentComms: schoolCommRows.rows.map((row) => ({
          id: row.id as string,
          commType: row.comm_type as string,
          subject: row.subject as string,
          occurredAt: (row.occurred_at as Date).toISOString(),
        })),
      },
    };
  }
}
