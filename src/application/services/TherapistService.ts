import { v7 as uuidv7 } from 'uuid';
import { Therapist } from '../../domain/entities/Therapist';
import { TherapistRepository, TherapistCreateInput, TherapistUpdateInput } from '../../domain/repositories/TherapistRepository';
import { TherapyType } from '../../domain/entities/Therapist';

export interface CreateTherapistPayload {
  name: string;
  specialty: TherapyType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface UpdateTherapistPayload {
  name?: string;
  specialty?: TherapyType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export class TherapistService {
  constructor(private readonly repo: TherapistRepository) {}

  list(userId: string): Promise<Therapist[]> {
    return this.repo.findAllByUser(userId);
  }

  async getById(id: string, userId: string): Promise<Therapist> {
    const therapist = await this.repo.findById(id, userId);
    if (!therapist) throw new Error(`Therapist ${id} not found`);
    return therapist;
  }

  create(payload: CreateTherapistPayload, userId: string): Promise<Therapist> {
    const input: TherapistCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateTherapistPayload, userId: string): Promise<Therapist> {
    const updated = await this.repo.update(id, userId, payload as TherapistUpdateInput);
    if (!updated) throw new Error(`Therapist ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`Therapist ${id} not found`);
  }
}
