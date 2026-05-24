export type TherapyType = 'aba' | 'ot' | 'fonoaudiologia' | 'psicologia' | 'fisioterapia';

export interface TherapistProps {
  id: string;
  userId: string;
  name: string;
  specialty: TherapyType;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Therapist {
  constructor(private readonly props: TherapistProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getName(): string { return this.props.name; }
  getSpecialty(): TherapyType { return this.props.specialty; }
  getPhone(): string | null { return this.props.phone; }
  getEmail(): string | null { return this.props.email; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      name: this.props.name,
      specialty: this.props.specialty,
      phone: this.props.phone,
      email: this.props.email,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
