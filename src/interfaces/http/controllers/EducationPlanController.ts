import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { EducationPlanService } from '../../../application/services/EducationPlanService';
import {
  createEducationPlanSchema,
  updateEducationPlanSchema,
  listEducationPlanFiltersSchema,
} from '../validations/educationValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class EducationPlanController {
  constructor(private readonly service: EducationPlanService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createEducationPlanSchema.parse(req.body);
    logger.info(`[educationPlan.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    jsonResponse(res, result.toJSON(), 201, { message: 'Plano educacional criado com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listEducationPlanFiltersSchema.parse(req.query);
    logger.info(`[educationPlan.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    jsonResponse(res, results.map((p: any) => p.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[educationPlan.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateEducationPlanSchema.parse(req.body);
    logger.info(`[educationPlan.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Plano educacional atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[educationPlan.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
