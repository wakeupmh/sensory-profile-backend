import { TherapySession, TherapySessionSummary } from '../entities/TherapySession';
import { TherapyType } from '../entities/Therapist';

export interface TherapySessionCreateInput {
  id: string;
  userId: string;
  childId: string;
  therapistId?: string | null;
  therapyType: TherapyType;
  occurredAt: Date;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface TherapySessionUpdateInput {
  therapistId?: string | null;
  therapyType?: TherapyType;
  occurredAt?: Date;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface TherapySessionFilters {
  childId?: string;
  therapyType?: TherapyType;
  therapistId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface TherapySessionRepository {
  save(input: TherapySessionCreateInput): Promise<TherapySession>;
  findById(id: string, userId: string): Promise<TherapySession | null>;
  findAllByUser(
    userId: string,
    filters: TherapySessionFilters,
  ): Promise<{ data: TherapySessionSummary[]; total: number; page: number; limit: number }>;
  update(id: string, userId: string, input: TherapySessionUpdateInput): Promise<TherapySession | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
