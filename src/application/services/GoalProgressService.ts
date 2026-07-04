import { v7 as uuidv7 } from 'uuid';
import { GoalProgressEntry } from '../../domain/entities/GoalProgressEntry';
import { GoalStatus } from '../../domain/entities/Goal';
import { GoalProgressEntryRepository } from '../../domain/repositories/GoalProgressEntryRepository';
import { GoalRepository } from '../../domain/repositories/GoalRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface CreateGoalProgressPayload {
  recordedAt: Date;
  value?: number | null;
  statusSnapshot?: GoalStatus | null;
  notes?: string | null;
  therapySessionId?: string | null;
}

export interface GoalProgressSummary {
  goalId: string;
  baselineValue: number | null;
  targetValue: number | null;
  latestValue: number | null;
  latestRecordedAt: Date | null;
  entryCount: number;
  deltaFromBaseline: number | null;
}

/**
 * Progress entries are a sub-resource of goals: every operation first
 * verifies the parent goal belongs to the caller (mirrors how AssessmentService
 * validates ownership of related entities before touching child records).
 */
export class GoalProgressService {
  constructor(
    private readonly progressRepo: GoalProgressEntryRepository,
    private readonly goalRepo: GoalRepository,
  ) {}

  private async assertGoalOwnership(goalId: string, userId: string) {
    const goal = await this.goalRepo.findById(goalId, userId);
    if (!goal) throw new NotFoundError('Meta', goalId);
    return goal;
  }

  async list(goalId: string, userId: string): Promise<GoalProgressEntry[]> {
    await this.assertGoalOwnership(goalId, userId);
    return this.progressRepo.findAllByGoal(goalId, userId);
  }

  async create(goalId: string, payload: CreateGoalProgressPayload, userId: string): Promise<GoalProgressEntry> {
    await this.assertGoalOwnership(goalId, userId);
    return this.progressRepo.save({
      id: uuidv7(),
      userId,
      goalId,
      ...payload,
    });
  }

  async remove(goalId: string, entryId: string, userId: string): Promise<void> {
    await this.assertGoalOwnership(goalId, userId);
    const ok = await this.progressRepo.delete(entryId, userId);
    if (!ok) throw new NotFoundError('Registro de progresso', entryId);
  }

  async getSummary(goalId: string, userId: string): Promise<GoalProgressSummary> {
    const goal = await this.assertGoalOwnership(goalId, userId);
    const entries = await this.progressRepo.findAllByGoal(goalId, userId);
    const latest = entries[0] ?? null; // findAllByGoal orders recorded_at DESC

    const baselineValue = goal.getBaselineValue();
    const latestValue = latest?.getValue() ?? null;

    return {
      goalId,
      baselineValue,
      targetValue: goal.getTargetValue(),
      latestValue,
      latestRecordedAt: latest?.getRecordedAt() ?? null,
      entryCount: entries.length,
      deltaFromBaseline:
        baselineValue != null && latestValue != null ? Math.round((latestValue - baselineValue) * 100) / 100 : null,
    };
  }
}
