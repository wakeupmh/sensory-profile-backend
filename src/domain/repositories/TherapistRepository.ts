import { Therapist, TherapyType } from '../entities/Therapist';

export interface TherapistCreateInput {
  id: string;
  userId: string;
  name: string;
  specialty: TherapyType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface TherapistUpdateInput {
  name?: string;
  specialty?: TherapyType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface TherapistRepository {
  save(input: TherapistCreateInput): Promise<Therapist>;
  findById(id: string, userId: string): Promise<Therapist | null>;
  findAllByUser(userId: string): Promise<Therapist[]>;
  update(id: string, userId: string, input: TherapistUpdateInput): Promise<Therapist | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
