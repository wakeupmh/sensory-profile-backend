import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { DevelopmentalMilestoneService } from '../../../application/services/DevelopmentalMilestoneService';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestoneFiltersSchema,
} from '../validations/developmentValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class DevelopmentalMilestoneController {
  constructor(private readonly service: DevelopmentalMilestoneService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createMilestoneSchema.parse(req.body);
    logger.info(`[developmentalMilestone.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    jsonResponse(res, result.toJSON(), 201, { message: 'Marco criado com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listMilestoneFiltersSchema.parse(req.query);
    logger.info(`[developmentalMilestone.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    jsonResponse(res, results.map((m: { toJSON: () => unknown }) => m.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[developmentalMilestone.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateMilestoneSchema.parse(req.body);
    logger.info(`[developmentalMilestone.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Marco atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[developmentalMilestone.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
