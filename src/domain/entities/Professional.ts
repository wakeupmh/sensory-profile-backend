export interface ProfessionalProps {
  id: string;
  ownerUserId: string;
  name: string;
  email: string | null;
  profession: string | null;
  invitationToken: string | null;
  acceptedUserId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProfessionalStatus = 'pending' | 'accepted';

export class Professional {
  readonly id: string;
  readonly ownerUserId: string;
  name: string;
  email: string | null;
  profession: string | null;
  invitationToken: string | null;
  acceptedUserId: string | null;
  acceptedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: ProfessionalProps) {
    this.id = props.id;
    this.ownerUserId = props.ownerUserId;
    this.name = props.name;
    this.email = props.email;
    this.profession = props.profession;
    this.invitationToken = props.invitationToken;
    this.acceptedUserId = props.acceptedUserId;
    this.acceptedAt = props.acceptedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get status(): ProfessionalStatus {
    return this.acceptedUserId ? 'accepted' : 'pending';
  }

  toOwnerView() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      profession: this.profession,
      status: this.status,
      invitationToken: this.invitationToken,
      acceptedAt: this.acceptedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
