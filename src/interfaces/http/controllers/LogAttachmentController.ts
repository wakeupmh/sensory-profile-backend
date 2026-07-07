import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { LogAttachmentService } from '../../../application/services/LogAttachmentService';
import { requestAttachmentUploadSchema } from '../validations/logAttachmentValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class LogAttachmentController {
  constructor(private readonly service: LogAttachmentService) {}

  requestUpload = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { id: logId } = req.params;
    assertValidId(logId, 'log ID');
    const parsed = requestAttachmentUploadSchema.parse(req.body);
    logger.info(`[logAttachment.requestUpload] userId=${userId} logId=${logId}`);
    const { attachment, uploadUrl } = await this.service.requestUpload(logId, parsed, userId);
    jsonResponse(
      res,
      { attachment: attachment.toJSON(), uploadUrl },
      201,
      { message: 'Envie o arquivo via PUT para uploadUrl dentro de 5 minutos' },
    );
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { id: logId } = req.params;
    assertValidId(logId, 'log ID');
    logger.info(`[logAttachment.list] userId=${userId} logId=${logId}`);
    const attachments = await this.service.listForLogWithUrls(logId, userId);
    jsonResponse(res, attachments);
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { id: logId, attachmentId } = req.params;
    assertValidId(logId, 'log ID');
    assertValidId(attachmentId, 'attachment ID');
    logger.info(`[logAttachment.remove] userId=${userId} logId=${logId} attachmentId=${attachmentId}`);
    await this.service.remove(logId, attachmentId, userId);
    res.status(204).send();
  });
}
