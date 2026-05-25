import { MedicalAppointment, MedicalAppointmentSummary } from '../../domain/entities/MedicalAppointment';
import { MedicalAppointmentRepository, MedicalAppointmentCreateInput, MedicalAppointmentUpdateInput, MedicalAppointmentFilters } from '../../domain/repositories/MedicalAppointmentRepository';
import { BaseDomainService } from './BaseDomainService';

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

export class MedicalAppointmentService extends BaseDomainService<
  MedicalAppointment,
  MedicalAppointmentCreateInput,
  MedicalAppointmentUpdateInput,
  CreateAppointmentPayload,
  UpdateAppointmentPayload,
  AppointmentFilters
> {
  constructor(repo: MedicalAppointmentRepository) {
    super(repo, 'Consulta médica não encontrada');
  }
}
