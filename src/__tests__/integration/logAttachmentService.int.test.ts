/**
 * Integration tests for LogAttachmentService.
 *
 * Tests exercise the service against mock repositories + a stub
 * S3StorageService and a mocked DailyLogService — no real database or S3
 * connection required.
 *
 * Covers:
 *  1. requestUpload throws NotFoundError when the log doesn't belong to the caller
 *  2. requestUpload builds storageKey as log-attachments/{userId}/{childId}/{logId}/{id}
 *  3. requestUpload returns the saved attachment and the presigned upload URL
 *  4. listForLog throws NotFoundError when the log doesn't belong to the caller
 *  5. listForLogWithUrls attaches a download URL to each attachment
 *  6. listForLogsBatched groups attachments by logId (no per-log ownership check —
 *     it's the batched, controller-driven list path)
 *  7. remove throws NotFoundError when the attachment doesn't belong to that log
 *  8. remove deletes the DB row and the S3 object for a valid attachment
 *  9. removeAllForLog deletes every attachment's S3 object for that log
 *  10. removeAllForLog is a no-op (no S3 calls) when the log has no attachments
 */

import { LogAttachmentService } from 'application/services/LogAttachmentService';
import { DailyLogService } from 'application/services/DailyLogService';
import { DailyLog } from 'domain/entities/DailyLog';
import { LogAttachment } from 'domain/entities/LogAttachment';
import type { LogAttachmentRepository } from 'domain/repositories/LogAttachmentRepository';
import type { S3StorageService } from 'infrastructure/storage/S3StorageService';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';

const USER_ID = 'user-001';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const LOG_ID = '018f4e8a-0000-7000-8000-000000000001';
const ATTACHMENT_ID = '018f4e8a-0000-7000-8000-000000000002';
const NOW = new Date('2024-06-15T10:30:00.000Z');
const UPLOAD_URL = 'https://s3.example.com/put-signed';
const DOWNLOAD_URL = 'https://s3.example.com/get-signed';

function makeLog(): DailyLog {
  return new DailyLog({
    id: LOG_ID,
    userId: USER_ID,
    childId: CHILD_ID,
    logType: 'mood',
    occurredAt: NOW,
    data: { level: 3 },
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function makeAttachment(overrides: Record<string, unknown> = {}): LogAttachment {
  return new LogAttachment({
    id: ATTACHMENT_ID,
    logId: LOG_ID,
    storageKey: `log-attachments/${USER_ID}/${CHILD_ID}/${LOG_ID}/${ATTACHMENT_ID}`,
    mimeType: 'image/jpeg',
    sizeBytes: 123456,
    createdAt: NOW,
    ...overrides,
  });
}

function makeAttachmentRepo(overrides: Partial<LogAttachmentRepository> = {}): LogAttachmentRepository {
  return {
    save: jest.fn().mockResolvedValue(makeAttachment()),
    findById: jest.fn().mockResolvedValue(makeAttachment()),
    findByLogId: jest.fn().mockResolvedValue([makeAttachment()]),
    findByLogIds: jest.fn().mockResolvedValue([makeAttachment()]),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStorage(overrides: Partial<S3StorageService> = {}): S3StorageService {
  return {
    getUploadUrl: jest.fn().mockResolvedValue(UPLOAD_URL),
    getDownloadUrl: jest.fn().mockResolvedValue(DOWNLOAD_URL),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as S3StorageService;
}

function makeDailyLogService(logExists = true): DailyLogService {
  return {
    getById: jest.fn().mockImplementation(() => {
      if (!logExists) throw new NotFoundError('Registro diário não encontrado', LOG_ID);
      return Promise.resolve(makeLog());
    }),
  } as unknown as DailyLogService;
}

function makeService(opts: {
  repo?: Partial<LogAttachmentRepository>;
  storage?: Partial<S3StorageService>;
  logExists?: boolean;
} = {}): LogAttachmentService {
  return new LogAttachmentService(
    makeAttachmentRepo(opts.repo),
    makeDailyLogService(opts.logExists ?? true),
    makeStorage(opts.storage),
  );
}

describe('LogAttachmentService', () => {
  test('requestUpload throws NotFoundError when the log does not belong to the caller', async () => {
    const service = makeService({ logExists: false });
    await expect(
      service.requestUpload(LOG_ID, { mimeType: 'image/jpeg' }, USER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  test('requestUpload builds storageKey as log-attachments/{userId}/{childId}/{logId}/{id}', async () => {
    const repo = makeAttachmentRepo();
    const service = makeService({ repo });
    await service.requestUpload(LOG_ID, { mimeType: 'image/jpeg' }, USER_ID);
    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.storageKey).toMatch(
      new RegExp(`^log-attachments/${USER_ID}/${CHILD_ID}/${LOG_ID}/[0-9a-f-]+$`),
    );
  });

  test('requestUpload returns the saved attachment and the presigned upload URL', async () => {
    const service = makeService();
    const result = await service.requestUpload(LOG_ID, { mimeType: 'image/jpeg' }, USER_ID);
    expect(result.attachment).toBeInstanceOf(LogAttachment);
    expect(result.uploadUrl).toBe(UPLOAD_URL);
  });

  test('listForLog throws NotFoundError when the log does not belong to the caller', async () => {
    const service = makeService({ logExists: false });
    await expect(service.listForLog(LOG_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  test('listForLogWithUrls attaches a download URL to each attachment', async () => {
    const service = makeService();
    const result = await service.listForLogWithUrls(LOG_ID, USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(DOWNLOAD_URL);
    expect(result[0].id).toBe(ATTACHMENT_ID);
  });

  test('listForLogsBatched groups attachments by logId', async () => {
    const otherAttachment = makeAttachment({ id: 'other-id', logId: 'other-log-id' });
    const repo = makeAttachmentRepo({
      findByLogIds: jest.fn().mockResolvedValue([makeAttachment(), otherAttachment]),
    });
    const service = makeService({ repo });
    const result = await service.listForLogsBatched([LOG_ID, 'other-log-id']);
    expect(result.get(LOG_ID)).toHaveLength(1);
    expect(result.get('other-log-id')).toHaveLength(1);
    expect(result.get(LOG_ID)?.[0].url).toBe(DOWNLOAD_URL);
  });

  test('remove throws NotFoundError when the attachment does not belong to that log', async () => {
    const repo = makeAttachmentRepo({
      findById: jest.fn().mockResolvedValue(makeAttachment({ logId: 'a-different-log-id' })),
    });
    const service = makeService({ repo });
    await expect(service.remove(LOG_ID, ATTACHMENT_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  test('remove deletes the DB row and the S3 object for a valid attachment', async () => {
    const repo = makeAttachmentRepo();
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    await service.remove(LOG_ID, ATTACHMENT_ID, USER_ID);
    expect(repo.delete).toHaveBeenCalledWith(ATTACHMENT_ID);
    expect(storage.deleteObject).toHaveBeenCalledWith(makeAttachment().getStorageKey());
  });

  test('removeAllForLog deletes every attachment S3 object for that log', async () => {
    const attachmentA = makeAttachment({ id: 'a', storageKey: 'key-a' });
    const attachmentB = makeAttachment({ id: 'b', storageKey: 'key-b' });
    const repo = makeAttachmentRepo({
      findByLogId: jest.fn().mockResolvedValue([attachmentA, attachmentB]),
    });
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    await service.removeAllForLog(LOG_ID, USER_ID);
    expect(storage.deleteObject).toHaveBeenCalledWith('key-a');
    expect(storage.deleteObject).toHaveBeenCalledWith('key-b');
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  test('removeAllForLog is a no-op (no S3 calls) when the log has no attachments', async () => {
    const repo = makeAttachmentRepo({ findByLogId: jest.fn().mockResolvedValue([]) });
    const storage = makeStorage();
    const service = makeService({ repo, storage });
    await service.removeAllForLog(LOG_ID, USER_ID);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
