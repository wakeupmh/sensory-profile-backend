import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { EducationPlanService } from '../../../application/services/EducationPlanService';
import {
  createEducationPlanSchema,
  updateEducationPlanSchema,
  listEducationPlanFiltersSchema,
} from '../validations/educationValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!(req as any).userId) throw new AuthenticationError();
  return (req as any).userId;
}

export class EducationPlanController {
  constructor(private readonly service: EducationPlanService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createEducationPlanSchema.parse(req.body);
    logger.info(`[educationPlan.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    res.status(201).json({
      success: true,
      data: result.toJSON(),
      message: 'Plano educacional criado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listEducationPlanFiltersSchema.parse(req.query);
    logger.info(`[educationPlan.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    res.status(200).json({
      success: true,
      data: results.map(p => p.toJSON()),
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[educationPlan.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    res.status(200).json({
      success: true,
      data: result.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateEducationPlanSchema.parse(req.body);
    logger.info(`[educationPlan.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({
      success: true,
      data: result.toJSON(),
      message: 'Plano educacional atualizado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[educationPlan.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
