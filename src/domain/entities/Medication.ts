export interface MedicationProps {
  id: string;
  userId: string;
  childId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startDate: string | null;
  endDate: string | null;
  prescribingDoctor: string | null;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Medication {
  constructor(private readonly props: MedicationProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getName(): string { return this.props.name; }
  getDosage(): string | null { return this.props.dosage; }
  getFrequency(): string | null { return this.props.frequency; }
  getStartDate(): string | null { return this.props.startDate; }
  getEndDate(): string | null { return this.props.endDate; }
  getPrescribingDoctor(): string | null { return this.props.prescribingDoctor; }
  isActive(): boolean { return this.props.active; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      name: this.props.name,
      dosage: this.props.dosage,
      frequency: this.props.frequency,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      prescribingDoctor: this.props.prescribingDoctor,
      active: this.props.active,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
