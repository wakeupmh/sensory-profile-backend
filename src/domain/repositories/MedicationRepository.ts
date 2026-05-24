import { Medication } from '../entities/Medication';

export interface MedicationCreateInput {
  id: string;
  userId: string;
  childId: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  prescribingDoctor?: string | null;
  active?: boolean;
  notes?: string | null;
}

export interface MedicationUpdateInput {
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  prescribingDoctor?: string | null;
  active?: boolean;
  notes?: string | null;
}

export interface MedicationFilters {
  childId?: string;
  active?: boolean;
}

export interface MedicationRepository {
  save(input: MedicationCreateInput): Promise<Medication>;
  findById(id: string, userId: string): Promise<Medication | null>;
  findAllByUser(userId: string, filters: MedicationFilters): Promise<Medication[]>;
  update(id: string, userId: string, input: MedicationUpdateInput): Promise<Medication | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
