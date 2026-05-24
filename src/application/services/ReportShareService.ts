import { v7 as uuidv7 } from 'uuid';
import { ReportShare } from '../../domain/entities/ReportShare';
import { ReportShareRepository } from '../../domain/repositories/ReportShareRepository';
import { ConsolidatedReportService, ConsolidatedSummary } from './ConsolidatedReportService';
import { NotFoundError, AuthorizationError } from '../../infrastructure/utils/errors/CustomErrors';

export class ReportShareService {
  constructor(
    private readonly repo: ReportShareRepository,
    private readonly consolidatedService: ConsolidatedReportService,
  ) {}

  async createShare(userId: string, childId: string, expiresInDays: number): Promise<ReportShare> {
    // Verify child ownership (throws NotFoundError if not found)
    await this.consolidatedService.getSummary(userId, childId, 1);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const share = new ReportShare({
      id: uuidv7(),
      userId,
      childId,
      token: crypto.randomUUID(),
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
    if (share.getExpiresAt() < new Date()) throw new AuthorizationError('Link expirado');
    return this.consolidatedService.getSummary(share.getUserId(), share.getChildId(), 90);
  }
}
