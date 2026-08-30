import { Entity } from './Entity';

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

export class ProfessionalNote extends Entity<ProfessionalNoteProps, 'authorUserId'> {

  protected hiddenFields() {
    return ['authorUserId'] as const;
  }

  getId(): string { return this.props.id; }
  getProfessionalId(): string { return this.props.professionalId; }
  getAuthorUserId(): string { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }

}
