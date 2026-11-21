import { Pool } from 'pg';
import { AccessLogRepository, AccessLogCreateInput, AccessLogListResult } from '../../domain/repositories/AccessLogRepository';
import logger from '../../infrastructure/utils/logger';
import { assertChildOwned } from './childAccess';

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
    await assertChildOwned(this.pool, childId, ownerUserId);
    return this.repo.listForChild(childId, page, limit);
  }
}
