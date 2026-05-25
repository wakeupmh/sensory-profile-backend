import { v7 as uuidv7 } from 'uuid';
import { Pool } from 'pg';
import { ReportShare } from '../../domain/entities/ReportShare';
import { ReportShareRepository } from '../../domain/repositories/ReportShareRepository';
import { ConsolidatedReportService, ConsolidatedSummary } from './ConsolidatedReportService';
import { NotFoundError, GoneError } from '../../infrastructure/utils/errors/CustomErrors';

export class ReportShareService {
  constructor(
    private readonly repo: ReportShareRepository,
    private readonly consolidatedService: ConsolidatedReportService,
    private readonly pool: Pool,
  ) {}

  async createShare(userId: string, childId: string, expiresInDays: number, periodDays: number = 90): Promise<ReportShare> {
    // Cheap ownership check (avoid running full consolidated summary)
    const result = await this.pool.query(
      'SELECT 1 FROM children WHERE id = $1 AND user_id = $2 LIMIT 1',
      [childId, userId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Criança não encontrada', childId);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const share = new ReportShare({
      id: uuidv7(),
      userId,
      childId,
      token: crypto.randomUUID(),
      periodDays,
      expiresAt,
      createdAt: now,
    });

    await this.repo.create(share);
    return share;
  }

  listShares(userId: string, childId: string): Promise<ReportShare[]> {
    return this.repo.findByUserAndChild(userId, childId);
  }

  deleteShare(id: string, userId: string): Promise<void> {
    return this.repo.deleteById(id, userId);
  }

  async getSharedSummary(token: string): Promise<ConsolidatedSummary> {
    const share = await this.repo.findByToken(token);
    if (!share) throw new NotFoundError('Relatório não encontrado');
    if (share.getExpiresAt() < new Date()) throw new GoneError('Link expirado');
    return this.consolidatedService.getSummary(share.getUserId(), share.getChildId(), share.getPeriodDays());
  }
}
