import { Request, Response } from 'express';
import { VoiceNoteService } from '../../../application/services/VoiceNoteService';
import { createVoiceNoteSchema } from '../validations/voiceNoteValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class VoiceNoteController {
  constructor(private readonly service: VoiceNoteService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { mimeType } = createVoiceNoteSchema.parse(req.body);
    logger.info(`[voiceNote.create] userId=${userId}`);

    const { note, uploadUrl } = await this.service.createDraft(userId, mimeType);
    jsonResponse(res, { note, uploadUrl }, 201);
  });

  start = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'voice note ID');
    const userId = requireUserId(req);

    jsonResponse(res, await this.service.startTranscription(userId, id));
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'voice note ID');
    const userId = requireUserId(req);

    jsonResponse(res, await this.service.get(userId, id));
  });
}
