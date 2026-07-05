import { Pool } from 'pg';
import { AccessLogRepository, AccessLogCreateInput, AccessLogListResult } from '../../domain/repositories/AccessLogRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import logger from '../../infrastructure/utils/logger';

export class AccessLogService {
  constructor(
    private readonly repo: AccessLogRepository,
    private readonly pool: Pool,
  ) {}

  /**
   * Best-effort: a logging failure must never break the read/write it's
   * describing. Errors are swallowed after being logged at warn level.
   */
  async record(input: AccessLogCreateInput): Promise<void> {
    try {
      await this.repo.record(input);
    } catch (error) {
      logger.warn('[AccessLogService] failed to record access log', {
        error: error instanceof Error ? error.message : String(error),
        resourceType: input.resourceType,
      });
    }
  }

  async listForChild(childId: string, ownerUserId: string, page: number, limit: number): Promise<AccessLogListResult> {
    const result = await this.pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, ownerUserId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
    return this.repo.listForChild(childId, page, limit);
  }
}
