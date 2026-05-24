import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { ComorbidityService } from '../../../application/services/ComorbidityService';
import { createComorbiditySchema, updateComorbiditySchema, listComorbidityFiltersSchema } from '../validations/medicalValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class ComorbidityController {
  constructor(private readonly service: ComorbidityService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listComorbidityFiltersSchema.parse(req.query);
    logger.info(`[comorbidity.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    res.status(200).json({ success: true, data: result.map(c => c.toJSON()), timestamp: new Date().toISOString() });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[comorbidity.getById] userId=${userId} id=${req.params.id}`);
    const comorbidity = await this.service.getById(req.params.id, userId);
    res.status(200).json({ success: true, data: comorbidity.toJSON(), timestamp: new Date().toISOString() });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createComorbiditySchema.parse(req.body);
    logger.info(`[comorbidity.create] userId=${userId}`);
    const comorbidity = await this.service.create(parsed, userId);
    res.status(201).json({ success: true, data: comorbidity.toJSON(), message: 'Comorbidade criada com sucesso', timestamp: new Date().toISOString() });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateComorbiditySchema.parse(req.body);
    logger.info(`[comorbidity.update] userId=${userId} id=${req.params.id}`);
    const comorbidity = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({ success: true, data: comorbidity.toJSON(), message: 'Comorbidade atualizada com sucesso', timestamp: new Date().toISOString() });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[comorbidity.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
