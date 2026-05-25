import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { ComorbidityService } from '../../../application/services/ComorbidityService';
import { createComorbiditySchema, updateComorbiditySchema, listComorbidityFiltersSchema } from '../validations/medicalValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class ComorbidityController {
  constructor(private readonly service: ComorbidityService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listComorbidityFiltersSchema.parse(req.query);
    logger.info(`[comorbidity.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    jsonResponse(res, result.map(c => c.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[comorbidity.getById] userId=${userId} id=${req.params.id}`);
    const comorbidity = await this.service.getById(req.params.id, userId);
    jsonResponse(res, comorbidity.toJSON());
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createComorbiditySchema.parse(req.body);
    logger.info(`[comorbidity.create] userId=${userId}`);
    const comorbidity = await this.service.create(parsed, userId);
    jsonResponse(res, comorbidity.toJSON(), 201, { message: 'Comorbidade criada com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateComorbiditySchema.parse(req.body);
    logger.info(`[comorbidity.update] userId=${userId} id=${req.params.id}`);
    const comorbidity = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, comorbidity.toJSON(), 200, { message: 'Comorbidade atualizada com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[comorbidity.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
