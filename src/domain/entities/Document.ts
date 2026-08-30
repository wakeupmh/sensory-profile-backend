import { Entity } from './Entity';

export interface DocumentProps {
  id: string;
  userId: string;
  /** `sub` de quem escreveu, quando difere do dono (`userId`). NULL = dono, ou anterior ao care team. */
  authorUserId: string | null;
  childId: string;
  title: string;
  description: string | null;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  resourceType: string | null;
  resourceId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Document extends Entity<DocumentProps, 'storageKey'> {

  protected hiddenFields() {
    return ['storageKey'] as const;
  }

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getAuthorUserId(): string | null { return this.props.authorUserId; }
  getChildId(): string { return this.props.childId; }
  getStorageKey(): string { return this.props.storageKey; }
  getSizeBytes(): number | null { return this.props.sizeBytes; }

}
