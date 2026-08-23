import { Request, Response } from 'express';
import { DailyReportService } from '../../../application/services/DailyReportService';
import {
  createDailyReportSchema,
  listDailyReportsSchema,
} from '../validations/dailyReportValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class DailyReportController {
  constructor(private readonly service: DailyReportService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId, limit } = listDailyReportsSchema.parse(req.query);
    logger.info(`[dailyReport.list] userId=${userId} childId=${childId}`);

    jsonResponse(res, await this.service.list(userId, childId, limit));
  });

  /**
   * Step 1 of the recording flow: reserve the day's report and hand back a
   * presigned PUT URL. The audio bytes never pass through the backend.
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId, reportDate, mimeType } = createDailyReportSchema.parse(req.body);
    logger.info(`[dailyReport.create] userId=${userId} childId=${childId} date=${reportDate}`);

    const { report, uploadUrl } = await this.service.createDraft(userId, childId, reportDate, mimeType);
    jsonResponse(res, { report, uploadUrl }, 201);
  });

  /** Step 2: the client finished the upload, so the transcription job can start. */
  start = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'report ID');
    const userId = requireUserId(req);
    logger.info(`[dailyReport.start] id=${id} userId=${userId}`);

    jsonResponse(res, await this.service.startTranscription(userId, id));
  });

  /**
   * Step 3: polled by the client while the status is `transcribing`. The
   * service advances the state as a side effect of being read, so there is no
   * separate "check job" endpoint to keep in sync with this one.
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'report ID');
    const userId = requireUserId(req);

    jsonResponse(res, await this.service.get(userId, id));
  });

  getAudioUrl = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'report ID');
    const userId = requireUserId(req);
    logger.info(`[dailyReport.getAudioUrl] id=${id} userId=${userId}`);

    jsonResponse(res, { url: await this.service.getAudioUrl(userId, id) });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'report ID');
    const userId = requireUserId(req);
    logger.info(`[dailyReport.remove] id=${id} userId=${userId}`);

    await this.service.delete(userId, id);
    jsonMessage(res, 'Relato removido com sucesso');
  });
}
