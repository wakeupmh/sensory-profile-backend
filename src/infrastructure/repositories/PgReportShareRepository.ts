import pool from '../database/connection';
import { ReportShare, ReportShareProps } from '../../domain/entities/ReportShare';
import { ReportShareRepository } from '../../domain/repositories/ReportShareRepository';

export class PgReportShareRepository implements ReportShareRepository {
  private mapRow(row: Record<string, unknown>): ReportShare {
    const props = {
      id: row.id as string,
      userId: row.user_id as string,
      childId: row.child_id as string,
      token: row.token as string,
      expiresAt: new Date(row.expires_at as string),
      createdAt: new Date(row.created_at as string),
    } satisfies ReportShareProps;
    return new ReportShare(props);
  }

  async create(share: ReportShare): Promise<void> {
    await pool.query(
      `INSERT INTO report_shares (id, user_id, child_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        share.getId(),
        share.getUserId(),
        share.getChildId(),
        share.getToken(),
        share.getExpiresAt().toISOString(),
        share.getCreatedAt().toISOString(),
      ],
    );
  }

  async findByToken(token: string): Promise<ReportShare | null> {
    const result = await pool.query(
      `SELECT * FROM report_shares WHERE token = $1`,
      [token],
    );
    return result.rows.length === 0 ? null : this.mapRow(result.rows[0]);
  }

  async findByUserAndChild(userId: string, childId: string): Promise<ReportShare[]> {
    const result = await pool.query(
      `SELECT * FROM report_shares WHERE user_id = $1 AND child_id = $2 ORDER BY created_at DESC`,
      [userId, childId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await pool.query(
      `DELETE FROM report_shares WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }
}
