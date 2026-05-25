import { Request, Response } from 'express';
import { FormDraftService } from '../../../application/services/FormDraftService';
import { upsertDraftSchema, assertValidFormType } from '../validations/draftValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class FormDraftController {
  constructor(private readonly service: FormDraftService) {}

  get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    assertValidFormType(form_type);
    logger.info(`[draft.get] userId=${userId} form_type=${form_type}`);

    const draft = await this.service.get(userId, form_type);

    jsonResponse(res, draft ? draft.toJSON() : null);
  });

  upsert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    assertValidFormType(form_type);
    const body = upsertDraftSchema.parse(req.body);
    logger.info(`[draft.upsert] userId=${userId} form_type=${form_type} step=${body.currentStep}`);

    const draft = await this.service.upsert({
      userId,
      formType: form_type,
      payload: body.payload as Record<string, unknown>,
      currentStep: body.currentStep,
      instrumentId: body.instrumentId,
    });

    jsonResponse(res, draft.toJSON());
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    assertValidFormType(form_type);
    logger.info(`[draft.delete] userId=${userId} form_type=${form_type}`);

    await this.service.delete(userId, form_type);

    res.status(204).send();
  });
}
