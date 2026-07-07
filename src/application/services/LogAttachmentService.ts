import { v7 as uuidv7 } from 'uuid';
import { LogAttachment } from '../../domain/entities/LogAttachment';
import { LogAttachmentRepository } from '../../domain/repositories/LogAttachmentRepository';
import { S3StorageService } from '../../infrastructure/storage/S3StorageService';
import { DailyLogService } from './DailyLogService';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

export interface RequestAttachmentUploadPayload {
  mimeType: string;
  sizeBytes?: number | null;
}

export interface RequestAttachmentUploadResult {
  attachment: LogAttachment;
  uploadUrl: string;
}

export interface AttachmentWithUrl {
  id: string;
  logId: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: Date;
  url: string;
}

/**
 * Photo attachments on a daily log. Ownership is enforced entirely through
 * DailyLogService.getById(logId, userId) — the same check already applied
 * to every other log operation (including under caregiver delegation, since
 * requireUserId(req) resolves to the delegated owner's id upstream) — so
 * there is no separate/parallel ACL path to keep in sync.
 */
export class LogAttachmentService {
  constructor(
    private readonly repo: LogAttachmentRepository,
    private readonly dailyLogService: DailyLogService,
    private readonly storage: S3StorageService,
  ) {}

  async requestUpload(
    logId: string,
    payload: RequestAttachmentUploadPayload,
    userId: string,
  ): Promise<RequestAttachmentUploadResult> {
    const log = await this.dailyLogService.getById(logId, userId);

    const id = uuidv7();
    const storageKey = `log-attachments/${userId}/${log.getChildId()}/${logId}/${id}`;
    const uploadUrl = await this.storage.getUploadUrl(storageKey, payload.mimeType);

    const attachment = await this.repo.save({
      id,
      logId,
      storageKey,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes ?? null,
    });

    return { attachment, uploadUrl };
  }

  async listForLog(logId: string, userId: string): Promise<LogAttachment[]> {
    await this.dailyLogService.getById(logId, userId);
    return this.repo.findByLogId(logId);
  }

  /** Batched attachments-with-download-URLs for a set of logs, keyed by logId. */
  async listForLogsBatched(logIds: string[]): Promise<Map<string, AttachmentWithUrl[]>> {
    const attachments = await this.repo.findByLogIds(logIds);
    const withUrls = await this.attachUrls(attachments);

    const byLogId = new Map<string, AttachmentWithUrl[]>();
    for (const a of withUrls) {
      const list = byLogId.get(a.logId) ?? [];
      list.push(a);
      byLogId.set(a.logId, list);
    }
    return byLogId;
  }

  async listForLogWithUrls(logId: string, userId: string): Promise<AttachmentWithUrl[]> {
    const attachments = await this.listForLog(logId, userId);
    return this.attachUrls(attachments);
  }

  /**
   * Deletes every attachment's S3 object ahead of the log row itself being
   * deleted. The DB rows are cleaned up for free by log_attachments'
   * ON DELETE CASCADE — this only handles the S3 side, which cascade can't
   * reach. Runs before the log delete (not after) so the storage keys are
   * still available to retry from if an S3 delete fails partway through;
   * S3 DeleteObject is idempotent for already-removed keys, so re-running
   * this after a partial failure is safe.
   */
  async removeAllForLog(logId: string, userId: string): Promise<void> {
    const attachments = await this.listForLog(logId, userId);
    await Promise.all(attachments.map((a) => this.storage.deleteObject(a.getStorageKey())));
  }

  async remove(logId: string, attachmentId: string, userId: string): Promise<void> {
    await this.dailyLogService.getById(logId, userId);

    const attachment = await this.repo.findById(attachmentId);
    if (!attachment || attachment.getLogId() !== logId) {
      throw new NotFoundError('Anexo', attachmentId);
    }

    await this.repo.delete(attachmentId);
    await this.storage.deleteObject(attachment.getStorageKey());
  }

  private async attachUrls(attachments: LogAttachment[]): Promise<AttachmentWithUrl[]> {
    return Promise.all(
      attachments.map(async (a) => ({
        ...a.toJSON(),
        url: await this.storage.getDownloadUrl(a.getStorageKey()),
      })),
    );
  }
}
