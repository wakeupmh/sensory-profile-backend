import { Therapist } from '../../domain/entities/Therapist';
import { TherapistRepository, TherapistCreateInput, TherapistUpdateInput } from '../../domain/repositories/TherapistRepository';
import { TherapyType } from '../../domain/entities/Therapist';
import { BaseDomainService } from './BaseDomainService';

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

export class TherapistService extends BaseDomainService<
  Therapist,
  TherapistCreateInput,
  TherapistUpdateInput,
  CreateTherapistPayload,
  UpdateTherapistPayload,
  void
> {
  constructor(repo: TherapistRepository) {
    super(repo, 'Therapist');
  }
}
