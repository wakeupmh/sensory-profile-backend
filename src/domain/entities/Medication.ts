import { Entity } from './Entity';

export interface MedicationProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
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

export class Medication extends Entity<MedicationProps> {

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
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

}
