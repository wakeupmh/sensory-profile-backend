export interface ProfessionalNoteProps {
  id: string;
  professionalId: string;
  authorUserId: string;
  childId: string;
  resourceType: string | null;
  resourceId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProfessionalNote {
  constructor(private readonly props: ProfessionalNoteProps) {}

  getId(): string { return this.props.id; }
  getProfessionalId(): string { return this.props.professionalId; }
  getAuthorUserId(): string { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }

  toJSON() {
    return {
      id: this.props.id,
      professionalId: this.props.professionalId,
      childId: this.props.childId,
      resourceType: this.props.resourceType,
      resourceId: this.props.resourceId,
      content: this.props.content,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
