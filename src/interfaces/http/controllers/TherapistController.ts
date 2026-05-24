import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { TherapistService } from '../../../application/services/TherapistService';
import { createTherapistSchema, updateTherapistSchema } from '../validations/therapistValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class TherapistController {
  constructor(private readonly service: TherapistService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    logger.info(`[therapist.list] userId=${userId}`);
    const therapists = await this.service.list(userId);
    res.status(200).json({ success: true, data: therapists, timestamp: new Date().toISOString() });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapist.getById] userId=${userId} id=${req.params.id}`);
    const therapist = await this.service.getById(req.params.id, userId);
    res.status(200).json({ success: true, data: therapist, timestamp: new Date().toISOString() });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createTherapistSchema.parse(req.body);
    logger.info(`[therapist.create] userId=${userId}`);
    const therapist = await this.service.create(parsed, userId);
    res.status(201).json({ success: true, data: therapist, message: 'Terapeuta criado com sucesso', timestamp: new Date().toISOString() });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateTherapistSchema.parse(req.body);
    logger.info(`[therapist.update] userId=${userId} id=${req.params.id}`);
    const therapist = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({ success: true, data: therapist, message: 'Terapeuta atualizado com sucesso', timestamp: new Date().toISOString() });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapist.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
