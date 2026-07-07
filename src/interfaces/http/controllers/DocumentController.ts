import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { DocumentService } from '../../../application/services/DocumentService';
import {
  requestUploadSchema,
  updateDocumentSchema,
  listDocumentFiltersSchema,
} from '../validations/documentValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  requestUpload = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = requestUploadSchema.parse(req.body);
    logger.info(`[document.requestUpload] userId=${userId} childId=${parsed.childId}`);
    const { document, uploadUrl } = await this.service.requestUpload(
      { ...parsed, expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null },
      userId,
    );
    jsonResponse(
      res,
      { document: document.toJSON(), uploadUrl },
      201,
      { message: 'Envie o arquivo via PUT para uploadUrl dentro de 5 minutos' },
    );
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listDocumentFiltersSchema.parse(req.query);
    logger.info(`[document.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    jsonResponse(res, results.map((d: { toJSON: () => unknown }) => d.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[document.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[document.downloadUrl] userId=${userId} id=${req.params.id}`);
    const downloadUrl = await this.service.getDownloadUrl(req.params.id, userId);
    jsonResponse(res, { downloadUrl });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateDocumentSchema.parse(req.body);
    logger.info(`[document.update] userId=${userId} id=${req.params.id}`);
    // Only convert/forward expiresAt when the caller actually sent it —
    // spreading an always-present key here would make every update clear
    // the expiry date even when the caller only meant to change the title.
    const { expiresAt, ...rest } = parsed;
    const payload = {
      ...rest,
      ...('expiresAt' in parsed ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
    };
    const result = await this.service.update(req.params.id, payload, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Documento atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[document.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
