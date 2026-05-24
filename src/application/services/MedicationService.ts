import { v7 as uuidv7 } from 'uuid';
import { Medication } from '../../domain/entities/Medication';
import { MedicationRepository, MedicationCreateInput, MedicationUpdateInput } from '../../domain/repositories/MedicationRepository';

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

export class MedicationService {
  constructor(private readonly repo: MedicationRepository) {}

  list(userId: string, filters: { childId?: string; active?: boolean }): Promise<Medication[]> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<Medication> {
    const medication = await this.repo.findById(id, userId);
    if (!medication) throw new Error(`Medication ${id} not found`);
    return medication;
  }

  create(payload: CreateMedicationPayload, userId: string): Promise<Medication> {
    const input: MedicationCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateMedicationPayload, userId: string): Promise<Medication> {
    const updated = await this.repo.update(id, userId, payload as MedicationUpdateInput);
    if (!updated) throw new Error(`Medication ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`Medication ${id} not found`);
  }
}
