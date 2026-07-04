import { v7 as uuidv7 } from 'uuid';
import { AiSummary } from '../../domain/entities/AiSummary';
import { AiSummaryRepository } from '../../domain/repositories/AiSummaryRepository';
import { AISummaryService } from './AISummaryService';

/**
 * Wraps AISummaryService.generateSummary with persistence, so the care team
 * can compare quarter-over-quarter instead of the text being thrown away
 * after each request (which is what the original /ai-summary endpoint did).
 */
export class AiSummaryHistoryService {
  constructor(
    private readonly repo: AiSummaryRepository,
    private readonly aiService: AISummaryService,
  ) {}

  async generateAndSave(userId: string, childId: string, periodDays: number): Promise<AiSummary> {
    const content = await this.aiService.generateSummary(userId, childId, periodDays);

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - periodDays);

    return this.repo.save({
      id: uuidv7(),
      userId,
      childId,
      periodFrom: from,
      periodTo: to,
      modelId: this.aiService.getModelId(),
      content,
    });
  }

  list(childId: string, userId: string): Promise<AiSummary[]> {
    return this.repo.findAllByChild(childId, userId);
  }
}
