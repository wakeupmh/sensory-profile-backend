import { Medication } from '../../domain/entities/Medication';
import { MedicationRepository, MedicationCreateInput, MedicationUpdateInput } from '../../domain/repositories/MedicationRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateMedicationPayload {
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

export interface UpdateMedicationPayload {
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  prescribingDoctor?: string | null;
  active?: boolean;
  notes?: string | null;
}

export class MedicationService extends BaseDomainService<
  Medication,
  MedicationCreateInput,
  MedicationUpdateInput,
  CreateMedicationPayload,
  UpdateMedicationPayload,
  { childId?: string; active?: boolean }
> {
  constructor(repo: MedicationRepository) {
    super(repo, 'Medicamento não encontrado');
  }
}
