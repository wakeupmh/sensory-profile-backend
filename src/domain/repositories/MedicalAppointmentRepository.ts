import { MedicalAppointment, MedicalAppointmentSummary } from '../entities/MedicalAppointment';

export interface MedicalAppointmentCreateInput {
  id: string;
  userId: string;
  childId: string;
  doctorName?: string | null;
  specialty?: string | null;
  clinicName?: string | null;
  occurredAt: Date;
  summary?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface MedicalAppointmentUpdateInput {
  doctorName?: string | null;
  specialty?: string | null;
  clinicName?: string | null;
  occurredAt?: Date;
  summary?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface MedicalAppointmentFilters {
  childId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface MedicalAppointmentRepository {
  save(input: MedicalAppointmentCreateInput): Promise<MedicalAppointment>;
  findById(id: string, userId: string): Promise<MedicalAppointment | null>;
  findAllByUser(
    userId: string,
    filters: MedicalAppointmentFilters,
  ): Promise<{ data: MedicalAppointmentSummary[]; total: number; page: number; limit: number }>;
  update(id: string, userId: string, input: MedicalAppointmentUpdateInput): Promise<MedicalAppointment | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
