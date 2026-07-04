export const CHILD_SHARE_SCOPES = ['assessments', 'daily_logs', 'therapy', 'medical', 'development'] as const;
export type ChildShareScope = (typeof CHILD_SHARE_SCOPES)[number];

export type ProfessionalAccessStatus = 'pending' | 'accepted';

export interface ChildShareGrantProps {
  id: string;
  childId: string;
  professionalId: string;
  professionalName: string;
  professionalStatus: ProfessionalAccessStatus;
  grantedByUserId: string;
  scopes: ChildShareScope[];
  createdAt: Date;
  updatedAt: Date;
}

/** Owner-facing view of a child-level grant (includes professional details). */
export class ChildShareGrant {
  constructor(private readonly props: ChildShareGrantProps) {}

  getChildId(): string { return this.props.childId; }
  getProfessionalId(): string { return this.props.professionalId; }
  getScopes(): ChildShareScope[] { return this.props.scopes; }

  toJSON() {
    return {
      id: this.props.id,
      childId: this.props.childId,
      professionalId: this.props.professionalId,
      professionalName: this.props.professionalName,
      professionalStatus: this.props.professionalStatus,
      grantedByUserId: this.props.grantedByUserId,
      scopes: this.props.scopes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
