import { v7 as uuidv7 } from 'uuid';
import { TherapySession } from '../../domain/entities/TherapySession';
import { TherapySessionRepository, TherapySessionCreateInput, TherapySessionUpdateInput, TherapySessionFilters } from '../../domain/repositories/TherapySessionRepository';
import { TherapistRepository } from '../../domain/repositories/TherapistRepository';
import { TherapyType } from '../../domain/entities/Therapist';
import { BaseDomainService } from './BaseDomainService';

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

export class TherapySessionService extends BaseDomainService<
  TherapySession,
  TherapySessionCreateInput,
  TherapySessionUpdateInput,
  CreateSessionPayload,
  UpdateSessionPayload,
  TherapySessionFilters
> {
  private readonly therapistRepo: TherapistRepository;

  constructor(
    repo: TherapySessionRepository,
    therapistRepo: TherapistRepository,
  ) {
    super(repo, 'Therapy session');
    this.therapistRepo = therapistRepo;
  }

  // Override: validate therapistId before creating
  async create(payload: CreateSessionPayload, userId: string): Promise<TherapySession> {
    if (payload.therapistId) {
      const therapist = await this.therapistRepo.findById(payload.therapistId, userId);
      if (!therapist) throw new Error(`Therapist ${payload.therapistId} not found`);
    }
    return super.create(payload, userId);
  }

  // Override: validate therapistId before updating
  async update(id: string, payload: UpdateSessionPayload, userId: string): Promise<TherapySession> {
    if (payload.therapistId) {
      const therapist = await this.therapistRepo.findById(payload.therapistId, userId);
      if (!therapist) throw new Error(`Therapist ${payload.therapistId} not found`);
    }
    return super.update(id, payload, userId);
  }
}
