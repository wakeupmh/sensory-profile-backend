import { Pool } from 'pg';
import { Reminder } from '../../domain/entities/Reminder';
import { ReminderRepository } from '../../domain/repositories/ReminderRepository';

export type DerivedReminderType =
  | 'medical_followup'
  | 'education_review'
  | 'education_plan_end'
  | 'school_followup'
  | 'milestone_target'
  | 'medication_ending';

export interface UpcomingReminderItem {
  source: 'custom' | 'derived';
  type: string;
  id: string;
  childId: string;
  title: string;
  dueAt: string;
  resourceType: string | null;
  resourceId: string | null;
}

interface DerivedRow {
  id: string;
  child_id: string;
  title: string;
  due_at: string;
}

/**
 * Merges user-created reminders with dates already captured elsewhere in the
 * hub (follow-ups, plan reviews, milestone targets, medication end dates) so
 * the dashboard has a single "what's coming up" feed without duplicating
 * those dates into the reminders table.
 */
export class UpcomingReminderService {
  constructor(
    private readonly pool: Pool,
    private readonly reminderRepo: ReminderRepository,
  ) {}

  async getUpcoming(userId: string, childId: string | undefined, days: number): Promise<UpcomingReminderItem[]> {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [custom, medical, eduReview, eduEnd, schoolFollowup, milestones, medications] = await Promise.all([
      this.reminderRepo.findAllByUser(userId, { childId, status: 'pending' }),
      this.queryDerived(
        `SELECT id, child_id, COALESCE('Retorno: ' || specialty, 'Retorno médico') AS title, follow_up_date::timestamptz AS due_at
         FROM medical_appointments
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND follow_up_date IS NOT NULL AND follow_up_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
      this.queryDerived(
        `SELECT id, child_id, 'Revisão do PEI: ' || school_name AS title, review_date::timestamptz AS due_at
         FROM education_plans
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND review_date IS NOT NULL AND review_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
      this.queryDerived(
        `SELECT id, child_id, 'Fim do plano: ' || school_name AS title, end_date::timestamptz AS due_at
         FROM education_plans
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND end_date IS NOT NULL AND end_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
      this.queryDerived(
        `SELECT id, child_id, 'Retorno escolar: ' || subject AS title, follow_up_date::timestamptz AS due_at
         FROM school_communications
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND follow_up_date IS NOT NULL AND follow_up_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
      this.queryDerived(
        `SELECT id, child_id, 'Meta de marco: ' || title AS title, target_date::timestamptz AS due_at
         FROM developmental_milestones
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND status != 'achieved' AND target_date IS NOT NULL AND target_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
      this.queryDerived(
        `SELECT id, child_id, 'Fim da medicação: ' || name AS title, end_date::timestamptz AS due_at
         FROM medications
         WHERE user_id = $1 AND ($2::uuid IS NULL OR child_id = $2)
           AND active = true AND end_date IS NOT NULL AND end_date BETWEEN $3 AND $4`,
        userId, childId, today, horizon,
      ),
    ]);

    const derived: UpcomingReminderItem[] = [
      ...this.toItems(medical, 'medical_followup', 'medical_appointment'),
      ...this.toItems(eduReview, 'education_review', 'education_plan'),
      ...this.toItems(eduEnd, 'education_plan_end', 'education_plan'),
      ...this.toItems(schoolFollowup, 'school_followup', 'school_communication'),
      ...this.toItems(milestones, 'milestone_target', 'developmental_milestone'),
      ...this.toItems(medications, 'medication_ending', 'medication'),
    ];

    const customItems: UpcomingReminderItem[] = custom
      .filter((r: Reminder) => r.getDueAt() <= horizon)
      .map((r: Reminder) => ({
        source: 'custom' as const,
        type: 'custom',
        id: r.getId(),
        childId: r.getChildId(),
        title: r.getTitle(),
        dueAt: r.getDueAt().toISOString(),
        resourceType: r.getResourceType(),
        resourceId: r.getResourceId(),
      }));

    return [...customItems, ...derived].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  private async queryDerived(sql: string, userId: string, childId: string | undefined, from: Date, to: Date) {
    const result = await this.pool.query<DerivedRow>(sql, [userId, childId ?? null, from, to]);
    return result.rows;
  }

  private toItems(rows: DerivedRow[], type: DerivedReminderType, resourceType: string): UpcomingReminderItem[] {
    return rows.map((row) => ({
      source: 'derived' as const,
      type,
      id: row.id,
      childId: row.child_id,
      title: row.title,
      dueAt: new Date(row.due_at).toISOString(),
      resourceType,
      resourceId: row.id,
    }));
  }
}
