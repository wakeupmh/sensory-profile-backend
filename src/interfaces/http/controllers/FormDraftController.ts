import { Request, Response } from 'express';
import { FormDraftService } from '../../../application/services/FormDraftService';
import { upsertDraftSchema, assertValidFormType } from '../validations/draftValidation';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class FormDraftController {
  constructor(private readonly service: FormDraftService) {}

  get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    try {
      assertValidFormType(form_type);
    } catch {
      throw new ValidationError(String(`Invalid form_type: ${form_type}`));
    }
    logger.info(`[draft.get] userId=${userId} form_type=${form_type}`);

    const draft = await this.service.get(userId, form_type);

    res.status(200).json({
      success: true,
      data: draft ? draft.toJSON() : null,
      timestamp: new Date().toISOString(),
    });
  });

  upsert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    try {
      assertValidFormType(form_type);
    } catch {
      throw new ValidationError(String(`Invalid form_type: ${form_type}`));
    }
    const body = upsertDraftSchema.parse(req.body);
    logger.info(`[draft.upsert] userId=${userId} form_type=${form_type} step=${body.currentStep}`);

    const draft = await this.service.upsert({
      userId,
      formType: form_type,
      payload: body.payload as Record<string, unknown>,
      currentStep: body.currentStep,
      instrumentId: body.instrumentId,
    });

    res.status(200).json({
      success: true,
      data: draft.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { form_type } = req.params;
    try {
      assertValidFormType(form_type);
    } catch {
      throw new ValidationError(String(`Invalid form_type: ${form_type}`));
    }
    logger.info(`[draft.delete] userId=${userId} form_type=${form_type}`);

    await this.service.delete(userId, form_type);

    res.status(204).send();
  });
}
