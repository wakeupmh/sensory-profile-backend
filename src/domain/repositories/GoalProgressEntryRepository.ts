import { GoalProgressEntry } from '../entities/GoalProgressEntry';
import { GoalStatus } from '../entities/Goal';

export interface GoalProgressEntryCreateInput {
  id: string;
  userId: string;
  goalId: string;
  recordedAt: Date;
  value?: number | null;
  statusSnapshot?: GoalStatus | null;
  notes?: string | null;
  therapySessionId?: string | null;
}

export interface GoalProgressEntryRepository {
  save(input: GoalProgressEntryCreateInput): Promise<GoalProgressEntry>;
  findById(id: string, userId: string): Promise<GoalProgressEntry | null>;
  findAllByGoal(goalId: string, userId: string): Promise<GoalProgressEntry[]>;
  delete(id: string, userId: string): Promise<boolean>;
}
