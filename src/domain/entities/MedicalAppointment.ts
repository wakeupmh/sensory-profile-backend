import { Entity } from './Entity';

export interface MedicalAppointmentProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  doctorName: string | null;
  specialty: string | null;
  clinicName: string | null;
  occurredAt: Date;
  summary: string | null;
  followUpDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalAppointmentSummary {
  id: string;
  childId: string;
  doctorName: string | null;
  specialty: string | null;
  clinicName: string | null;
  occurredAt: Date;
  summary: string | null;
  followUpDate: string | null;
  createdAt: Date;
}

export class MedicalAppointment extends Entity<MedicalAppointmentProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getDoctorName(): string | null { return this.props.doctorName; }
  getSpecialty(): string | null { return this.props.specialty; }
  getClinicName(): string | null { return this.props.clinicName; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getSummary(): string | null { return this.props.summary; }
  getFollowUpDate(): string | null { return this.props.followUpDate; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

}
