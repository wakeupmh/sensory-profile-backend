import { v7 as uuidv7 } from 'uuid';
import { TherapySession } from '../../domain/entities/TherapySession';
import { TherapySessionRepository, TherapySessionCreateInput, TherapySessionUpdateInput, TherapySessionFilters } from '../../domain/repositories/TherapySessionRepository';
import { TherapistRepository } from '../../domain/repositories/TherapistRepository';
import { TherapyType } from '../../domain/entities/Therapist';

export interface CreateSessionPayload {
  childId: string;
  therapistId?: string | null;
  therapyType: TherapyType;
  occurredAt: Date;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface UpdateSessionPayload {
  therapistId?: string | null;
  therapyType?: TherapyType;
  occurredAt?: Date;
  durationMinutes?: number | null;
  notes?: string | null;
}

export class TherapySessionService {
  constructor(
    private readonly repo: TherapySessionRepository,
    private readonly therapistRepo: TherapistRepository,
  ) {}

  list(userId: string, filters: TherapySessionFilters) {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<TherapySession> {
    const session = await this.repo.findById(id, userId);
    if (!session) throw new Error(`Therapy session ${id} not found`);
    return session;
  }

  async create(payload: CreateSessionPayload, userId: string): Promise<TherapySession> {
    if (payload.therapistId) {
      const therapist = await this.therapistRepo.findById(payload.therapistId, userId);
      if (!therapist) throw new Error(`Therapist ${payload.therapistId} not found`);
    }
    const input: TherapySessionCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateSessionPayload, userId: string): Promise<TherapySession> {
    if (payload.therapistId) {
      const therapist = await this.therapistRepo.findById(payload.therapistId, userId);
      if (!therapist) throw new Error(`Therapist ${payload.therapistId} not found`);
    }
    const updated = await this.repo.update(id, userId, payload as TherapySessionUpdateInput);
    if (!updated) throw new Error(`Therapy session ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`Therapy session ${id} not found`);
  }
}
