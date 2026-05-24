import { v7 as uuidv7 } from 'uuid';
import { MedicalAppointment } from '../../domain/entities/MedicalAppointment';
import { MedicalAppointmentRepository, MedicalAppointmentCreateInput, MedicalAppointmentUpdateInput } from '../../domain/repositories/MedicalAppointmentRepository';
import { MedicalAppointmentSummary } from '../../domain/entities/MedicalAppointment';

export interface CreateAppointmentPayload {
  childId: string;
  doctorName?: string | null;
  specialty?: string | null;
  clinicName?: string | null;
  occurredAt: Date;
  summary?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentPayload {
  doctorName?: string | null;
  specialty?: string | null;
  clinicName?: string | null;
  occurredAt?: Date;
  summary?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface AppointmentFilters {
  childId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export class MedicalAppointmentService {
  constructor(private readonly repo: MedicalAppointmentRepository) {}

  list(userId: string, filters: AppointmentFilters): Promise<{ data: MedicalAppointmentSummary[]; total: number; page: number; limit: number }> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<MedicalAppointment> {
    const appointment = await this.repo.findById(id, userId);
    if (!appointment) throw new Error(`MedicalAppointment ${id} not found`);
    return appointment;
  }

  create(payload: CreateAppointmentPayload, userId: string): Promise<MedicalAppointment> {
    const input: MedicalAppointmentCreateInput = {
      id: uuidv7(),
      userId,
      ...payload,
    };
    return this.repo.save(input);
  }

  async update(id: string, payload: UpdateAppointmentPayload, userId: string): Promise<MedicalAppointment> {
    const updated = await this.repo.update(id, userId, payload as MedicalAppointmentUpdateInput);
    if (!updated) throw new Error(`MedicalAppointment ${id} not found`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new Error(`MedicalAppointment ${id} not found`);
  }
}
