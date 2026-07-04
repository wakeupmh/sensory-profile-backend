import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { GoalService } from '../../../application/services/GoalService';
import {
  createGoalSchema,
  updateGoalSchema,
  listGoalFiltersSchema,
} from '../validations/goalValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class GoalController {
  constructor(private readonly service: GoalService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createGoalSchema.parse(req.body);
    logger.info(`[goal.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    jsonResponse(res, result.toJSON(), 201, { message: 'Meta criada com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listGoalFiltersSchema.parse(req.query);
    logger.info(`[goal.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    jsonResponse(res, results.map((g: { toJSON: () => unknown }) => g.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[goal.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateGoalSchema.parse(req.body);
    logger.info(`[goal.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Meta atualizada com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[goal.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
