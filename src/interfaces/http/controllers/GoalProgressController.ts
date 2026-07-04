import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { GoalProgressService } from '../../../application/services/GoalProgressService';
import { createGoalProgressSchema } from '../validations/goalValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class GoalProgressController {
  constructor(private readonly service: GoalProgressService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.goalId, 'goal ID');
    const userId = requireUserId(req);
    logger.info(`[goalProgress.list] userId=${userId} goalId=${req.params.goalId}`);
    const results = await this.service.list(req.params.goalId, userId);
    jsonResponse(res, results.map((e) => e.toJSON()));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.goalId, 'goal ID');
    const userId = requireUserId(req);
    const parsed = createGoalProgressSchema.parse(req.body);
    logger.info(`[goalProgress.create] userId=${userId} goalId=${req.params.goalId}`);
    const result = await this.service.create(
      req.params.goalId,
      { ...parsed, recordedAt: new Date(parsed.recordedAt) },
      userId,
    );
    jsonResponse(res, result.toJSON(), 201, { message: 'Progresso registrado com sucesso' });
  });

  getSummary = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.goalId, 'goal ID');
    const userId = requireUserId(req);
    logger.info(`[goalProgress.summary] userId=${userId} goalId=${req.params.goalId}`);
    const summary = await this.service.getSummary(req.params.goalId, userId);
    jsonResponse(res, summary);
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.goalId, 'goal ID');
    assertValidId(req.params.entryId, 'progress entry ID');
    const userId = requireUserId(req);
    logger.info(`[goalProgress.remove] userId=${userId} goalId=${req.params.goalId} entryId=${req.params.entryId}`);
    await this.service.remove(req.params.goalId, req.params.entryId, userId);
    res.status(204).send();
  });
}
