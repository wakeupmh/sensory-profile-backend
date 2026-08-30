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
   * Best-effort: uma falha de auditoria nunca pode derrubar a leitura ou
   * escrita que ela descreve.
   *
   * Mas o nível é `error`, e não `warn`: uma linha de auditoria perdida é um
   * evento de conformidade — é o responsável deixando de enxergar o que foi
   * feito com os dados da criança dele. Isso já aconteceu em silêncio quando
   * `resource_type` recebia a URL inteira e estourava o `VARCHAR(50)`, e
   * ninguém percebeu porque o log estava em `warn`. O input inteiro vai
   * junto para que a linha perdida seja reconstituível.
   */
  async record(input: AccessLogCreateInput): Promise<void> {
    try {
      await this.repo.record(input);
    } catch (error) {
      logger.error('[AccessLogService] linha de auditoria PERDIDA', {
        error: error instanceof Error ? error.message : String(error),
        actorUserId: input.actorUserId,
        childId: input.childId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
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
