export interface ChildProps {
  id: string;
  userId: string;
  name: string;
  birthDate: string;
  gender: string | null;
  nationalIdentity: string | null;
  otherInfo: string | null;
  sensoryTriggers: string | null;
  calmingStrategies: string | null;
  emergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Child {
  constructor(private readonly props: ChildProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getName(): string { return this.props.name; }
  getBirthDate(): string { return this.props.birthDate; }
  getGender(): string | null { return this.props.gender; }
  getNationalIdentity(): string | null { return this.props.nationalIdentity; }
  getOtherInfo(): string | null { return this.props.otherInfo; }
  getSensoryTriggers(): string | null { return this.props.sensoryTriggers; }
  getCalmingStrategies(): string | null { return this.props.calmingStrategies; }
  getEmergencyContact(): string | null { return this.props.emergencyContact; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      name: this.props.name,
      birthDate: this.props.birthDate,
      gender: this.props.gender,
      nationalIdentity: this.props.nationalIdentity,
      otherInfo: this.props.otherInfo,
      sensoryTriggers: this.props.sensoryTriggers,
      calmingStrategies: this.props.calmingStrategies,
      emergencyContact: this.props.emergencyContact,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
