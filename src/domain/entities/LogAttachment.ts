import { Entity } from './Entity';

export interface LogAttachmentProps {
  id: string;
  logId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: Date;
}

export class LogAttachment extends Entity<LogAttachmentProps, 'storageKey'> {

  protected hiddenFields() {
    return ['storageKey'] as const;
  }

  getId(): string { return this.props.id; }
  getLogId(): string { return this.props.logId; }
  getStorageKey(): string { return this.props.storageKey; }
  getMimeType(): string { return this.props.mimeType; }
  getSizeBytes(): number | null { return this.props.sizeBytes; }
  getCreatedAt(): Date { return this.props.createdAt; }

}
