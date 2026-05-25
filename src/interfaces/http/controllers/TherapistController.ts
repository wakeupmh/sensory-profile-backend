import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { TherapistService } from '../../../application/services/TherapistService';
import { createTherapistSchema, updateTherapistSchema } from '../validations/therapistValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class TherapistController {
  constructor(private readonly service: TherapistService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    logger.info(`[therapist.list] userId=${userId}`);
    const therapists = await this.service.list(userId);
    jsonResponse(res, therapists);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapist.getById] userId=${userId} id=${req.params.id}`);
    const therapist = await this.service.getById(req.params.id, userId);
    jsonResponse(res, therapist);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createTherapistSchema.parse(req.body);
    logger.info(`[therapist.create] userId=${userId}`);
    const therapist = await this.service.create(parsed, userId);
    jsonResponse(res, therapist, 201, { message: 'Terapeuta criado com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateTherapistSchema.parse(req.body);
    logger.info(`[therapist.update] userId=${userId} id=${req.params.id}`);
    const therapist = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, therapist, 200, { message: 'Terapeuta atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapist.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
