import { Pool } from 'pg';

export interface SharedChildSummary {
  id: string;
  name: string;
  birthDate: string | null;
  scopes: string[];
}

/**
 * Read-only, child_id-scoped queries used by the professional-side "shared
 * with me" endpoints. Deliberately independent of the owner-scoped
 * Pg*Repository classes used elsewhere: access here has already been
 * authorized via a child_shares scope check (see SharedChildController), and
 * child_id alone is enough to select the right rows regardless of which
 * user owns the child — there's no need to know or pass the owner's userId.
 */
export class SharedChildDataService {
  constructor(private readonly pool: Pool) {}

  async getChildrenSummaries(childIds: string[]): Promise<Map<string, { name: string; birthDate: string | null }>> {
    if (childIds.length === 0) return new Map();
    const result = await this.pool.query(
      `SELECT id, name, birth_date FROM children WHERE id = ANY($1::uuid[])`,
      [childIds],
    );
    const map = new Map<string, { name: string; birthDate: string | null }>();
    for (const row of result.rows) {
      map.set(row.id as string, {
        name: row.name as string,
        birthDate: row.birth_date ? new Date(row.birth_date as string).toISOString().slice(0, 10) : null,
      });
    }
    return map;
  }

  async getAssessments(childId: string) {
    const result = await this.pool.query(
      `SELECT id, instrument_id, assessment_date, created_at
       FROM sensory_assessments
       WHERE child_id = $1
       ORDER BY assessment_date DESC
       LIMIT 50`,
      [childId],
    );
    return result.rows;
  }

  async getDailyLogs(childId: string) {
    const result = await this.pool.query(
      `SELECT id, log_type, occurred_at, data, notes
       FROM daily_logs
       WHERE child_id = $1
       ORDER BY occurred_at DESC
       LIMIT 100`,
      [childId],
    );
    return result.rows;
  }

  async getTherapy(childId: string) {
    const result = await this.pool.query(
      `SELECT ts.id, ts.therapy_type, ts.occurred_at, ts.duration_minutes, ts.notes,
              t.name AS therapist_name, t.specialty AS therapist_specialty
       FROM therapy_sessions ts
       LEFT JOIN therapists t ON ts.therapist_id = t.id
       WHERE ts.child_id = $1
       ORDER BY ts.occurred_at DESC
       LIMIT 100`,
      [childId],
    );
    return result.rows;
  }

  async getMedical(childId: string) {
    const [medications, comorbidities, appointments] = await Promise.all([
      this.pool.query(
        `SELECT id, name, dosage, frequency, start_date, end_date, prescribing_doctor, active
         FROM medications WHERE child_id = $1 ORDER BY active DESC, start_date DESC NULLS LAST`,
        [childId],
      ),
      this.pool.query(
        `SELECT id, condition_name, icd_code, diagnosis_date, diagnosing_doctor
         FROM comorbidities WHERE child_id = $1 ORDER BY diagnosis_date DESC NULLS LAST`,
        [childId],
      ),
      this.pool.query(
        `SELECT id, doctor_name, specialty, clinic_name, occurred_at, summary, follow_up_date
         FROM medical_appointments WHERE child_id = $1 ORDER BY occurred_at DESC LIMIT 50`,
        [childId],
      ),
    ]);
    return {
      medications: medications.rows,
      comorbidities: comorbidities.rows,
      appointments: appointments.rows,
    };
  }

  async getDevelopment(childId: string) {
    const [milestones, communicationLogs] = await Promise.all([
      this.pool.query(
        `SELECT id, title, category, status, achieved_date, target_date
         FROM developmental_milestones WHERE child_id = $1 ORDER BY created_at DESC`,
        [childId],
      ),
      this.pool.query(
        `SELECT id, occurred_at, entry_type, description, words_count
         FROM communication_logs WHERE child_id = $1 ORDER BY occurred_at DESC LIMIT 50`,
        [childId],
      ),
    ]);
    return {
      milestones: milestones.rows,
      communicationLogs: communicationLogs.rows,
    };
  }
}
