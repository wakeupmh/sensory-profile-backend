import { v7 as uuidv7 } from 'uuid';
import pool from '../database/connection';
import { AccessLog, AccessLogProps, AccessLogAction } from '../../domain/entities/AccessLog';
import {
  AccessLogRepository,
  AccessLogCreateInput,
  AccessLogListResult,
} from '../../domain/repositories/AccessLogRepository';

export class PgAccessLogRepository implements AccessLogRepository {
  private mapRow(row: Record<string, unknown>): AccessLog {
    const props = {
      id: row.id as string,
      actorUserId: row.actor_user_id as string,
      professionalId: (row.professional_id as string | null) ?? null,
      childId: (row.child_id as string | null) ?? null,
      resourceType: row.resource_type as string,
      resourceId: (row.resource_id as string | null) ?? null,
      action: row.action as AccessLogAction,
      createdAt: new Date(row.created_at as string),
      actorName: (row.actor_name as string | null) ?? null,
    } satisfies AccessLogProps;
    return new AccessLog(props);
  }

  async record(input: AccessLogCreateInput): Promise<void> {
    await pool.query(
      `INSERT INTO access_logs (id, actor_user_id, professional_id, child_id, resource_type, resource_id, action)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv7(),
        input.actorUserId,
        input.professionalId ?? null,
        input.childId ?? null,
        input.resourceType,
        input.resourceId ?? null,
        input.action,
      ],
    );
  }

  async listForChild(childId: string, page: number, limit: number): Promise<AccessLogListResult> {
    const offset = (page - 1) * limit;
    const [dataResult, countResult] = await Promise.all([
      // O nome de quem agiu vem das tabelas de concessão desta MESMA criança:
      // é o responsável que registrou aquele nome ao convidar, então não há
      // vazamento de identidade de terceiros aqui. Ambos os joins batem em
      // índice (`idx_caregiver_shares_caregiver_user`, PK de professionals).
      // Quando a equipe de cuidado entrar, ela é a terceira fonte de nome.
      pool.query(
        `SELECT al.*, COALESCE(cs.caregiver_name, p.name) AS actor_name
           FROM access_logs al
           LEFT JOIN caregiver_shares cs
                  ON cs.child_id = al.child_id AND cs.caregiver_user_id = al.actor_user_id
           LEFT JOIN professionals p
                  ON p.id = al.professional_id
          WHERE al.child_id = $1
          ORDER BY al.created_at DESC
          LIMIT $2 OFFSET $3`,
        [childId, limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM access_logs WHERE child_id = $1`, [childId]),
    ]);
    return {
      data: dataResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0].count,
      page,
      limit,
    };
  }
}
