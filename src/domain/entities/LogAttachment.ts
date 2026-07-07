export interface LogAttachmentProps {
  id: string;
  logId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: Date;
}

export class LogAttachment {
  constructor(private readonly props: LogAttachmentProps) {}

  getId(): string { return this.props.id; }
  getLogId(): string { return this.props.logId; }
  getStorageKey(): string { return this.props.storageKey; }
  getMimeType(): string { return this.props.mimeType; }
  getSizeBytes(): number | null { return this.props.sizeBytes; }
  getCreatedAt(): Date { return this.props.createdAt; }

  toJSON() {
    return {
      id: this.props.id,
      logId: this.props.logId,
      mimeType: this.props.mimeType,
      sizeBytes: this.props.sizeBytes,
      createdAt: this.props.createdAt,
    };
  }
}
