export interface CaregiverShareProps {
  id: string;
  childId: string;
  ownerUserId: string;
  caregiverName: string;
  caregiverUserId: string | null;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CaregiverShare {
  constructor(private readonly props: CaregiverShareProps) {}

  getId(): string { return this.props.id; }
  getChildId(): string { return this.props.childId; }
  getOwnerUserId(): string { return this.props.ownerUserId; }
  getCaregiverUserId(): string | null { return this.props.caregiverUserId; }
  isAccepted(): boolean { return this.props.caregiverUserId !== null; }

  toOwnerView() {
    return {
      id: this.props.id,
      childId: this.props.childId,
      caregiverName: this.props.caregiverName,
      status: this.isAccepted() ? 'accepted' : 'pending',
      invitationToken: this.props.invitationToken,
      invitationExpiresAt: this.props.invitationExpiresAt,
      acceptedAt: this.props.acceptedAt,
      createdAt: this.props.createdAt,
    };
  }
}
