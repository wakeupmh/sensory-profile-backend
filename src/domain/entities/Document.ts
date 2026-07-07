export interface DocumentProps {
  id: string;
  userId: string;
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

export class Document {
  constructor(private readonly props: DocumentProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getStorageKey(): string { return this.props.storageKey; }
  getSizeBytes(): number | null { return this.props.sizeBytes; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      title: this.props.title,
      description: this.props.description,
      mimeType: this.props.mimeType,
      sizeBytes: this.props.sizeBytes,
      resourceType: this.props.resourceType,
      resourceId: this.props.resourceId,
      expiresAt: this.props.expiresAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
