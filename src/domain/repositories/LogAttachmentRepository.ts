import { LogAttachment } from '../entities/LogAttachment';

export interface LogAttachmentCreateInput {
  id: string;
  logId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number | null;
}

export interface LogAttachmentRepository {
  save(input: LogAttachmentCreateInput): Promise<LogAttachment>;
  findById(id: string): Promise<LogAttachment | null>;
  findByLogId(logId: string): Promise<LogAttachment[]>;
  /** Batched lookup for list views — avoids one query per log (N+1). */
  findByLogIds(logIds: string[]): Promise<LogAttachment[]>;
  delete(id: string): Promise<boolean>;
}
