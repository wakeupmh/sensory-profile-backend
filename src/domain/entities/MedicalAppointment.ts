export interface MedicalAppointmentProps {
  id: string;
  userId: string;
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

export class MedicalAppointment {
  constructor(private readonly props: MedicalAppointmentProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
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

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      doctorName: this.props.doctorName,
      specialty: this.props.specialty,
      clinicName: this.props.clinicName,
      occurredAt: this.props.occurredAt,
      summary: this.props.summary,
      followUpDate: this.props.followUpDate,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
