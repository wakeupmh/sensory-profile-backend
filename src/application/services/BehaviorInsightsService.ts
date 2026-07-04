import { Pool } from 'pg';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface BehaviorInsights {
  childId: string;
  periodDays: number;
  totalIncidents: number;
  previousPeriodIncidents: number;
  changePercent: number | null;
  averageIntensity: number | null;
  byWeekday: Array<{ weekday: number; count: number }>;
  byHour: Array<{ hour: number; count: number }>;
  topAntecedents: Array<{ value: string; count: number }>;
  topBehaviors: Array<{ value: string; count: number }>;
  recentIncidents: Array<{
    id: string;
    occurredAt: string;
    antecedent: string | null;
    behavior: string | null;
    consequence: string | null;
    intensity: number | null;
  }>;
}

/**
 * Read-only aggregation over daily_logs WHERE log_type = 'abc'. No new table —
 * ABC entries are collected via the existing daily-logs endpoint and this
 * service turns them into frequency/trend insights for the care team.
 */
export class BehaviorInsightsService {
  constructor(private readonly pool: Pool) {}

  async getInsights(childId: string, userId: string, periodDays: number): Promise<BehaviorInsights> {
    const ownerCheck = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, userId],
    );
    if (ownerCheck.rows.length === 0) {
      throw new NotFoundError('Criança', childId);
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays * 2);

    const [
      totalResult,
      previousResult,
      intensityResult,
      weekdayResult,
      hourResult,
      antecedentResult,
      behaviorResult,
      recentResult,
    ] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS cnt FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc'
           AND occurred_at >= $3 AND occurred_at < $4`,
        [userId, childId, previousPeriodStart, periodStart],
      ),
      this.pool.query(
        `SELECT AVG((data->>'intensity')::int) AS avg_intensity FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
           AND data->>'intensity' IS NOT NULL`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT EXTRACT(DOW FROM occurred_at)::int AS weekday, COUNT(*)::int AS cnt
         FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
         GROUP BY weekday ORDER BY weekday`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT EXTRACT(HOUR FROM occurred_at)::int AS hour, COUNT(*)::int AS cnt
         FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
         GROUP BY hour ORDER BY hour`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT data->>'antecedent' AS value, COUNT(*)::int AS cnt
         FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
           AND data->>'antecedent' IS NOT NULL
         GROUP BY value ORDER BY cnt DESC LIMIT 5`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT data->>'behavior' AS value, COUNT(*)::int AS cnt
         FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
           AND data->>'behavior' IS NOT NULL
         GROUP BY value ORDER BY cnt DESC LIMIT 5`,
        [userId, childId, periodStart],
      ),
      this.pool.query(
        `SELECT id, occurred_at, data
         FROM daily_logs
         WHERE user_id = $1 AND child_id = $2 AND log_type = 'abc' AND occurred_at >= $3
         ORDER BY occurred_at DESC LIMIT 10`,
        [userId, childId, periodStart],
      ),
    ]);

    const totalIncidents = Number(totalResult.rows[0]?.cnt ?? 0);
    const previousPeriodIncidents = Number(previousResult.rows[0]?.cnt ?? 0);
    const changePercent =
      previousPeriodIncidents === 0
        ? null
        : Math.round(((totalIncidents - previousPeriodIncidents) / previousPeriodIncidents) * 1000) / 10;

    const rawAvgIntensity = intensityResult.rows[0]?.avg_intensity;
    const averageIntensity = rawAvgIntensity == null ? null : Math.round(Number(rawAvgIntensity) * 10) / 10;

    return {
      childId,
      periodDays,
      totalIncidents,
      previousPeriodIncidents,
      changePercent,
      averageIntensity,
      byWeekday: weekdayResult.rows.map((r) => ({ weekday: Number(r.weekday), count: Number(r.cnt) })),
      byHour: hourResult.rows.map((r) => ({ hour: Number(r.hour), count: Number(r.cnt) })),
      topAntecedents: antecedentResult.rows.map((r) => ({ value: r.value as string, count: Number(r.cnt) })),
      topBehaviors: behaviorResult.rows.map((r) => ({ value: r.value as string, count: Number(r.cnt) })),
      recentIncidents: recentResult.rows.map((r) => {
        const data = (r.data ?? {}) as Record<string, unknown>;
        return {
          id: r.id as string,
          occurredAt: new Date(r.occurred_at as string).toISOString(),
          antecedent: (data.antecedent as string) ?? null,
          behavior: (data.behavior as string) ?? null,
          consequence: (data.consequence as string) ?? null,
          intensity: (data.intensity as number) ?? null,
        };
      }),
    };
  }
}
