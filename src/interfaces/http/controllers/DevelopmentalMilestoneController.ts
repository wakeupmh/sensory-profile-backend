import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { DevelopmentalMilestoneService } from '../../../application/services/DevelopmentalMilestoneService';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestoneFiltersSchema,
  idParamSchema,
} from '../validations/developmentValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!(req as any).userId) throw new AuthenticationError();
  return (req as any).userId;
}

export class DevelopmentalMilestoneController {
  constructor(private readonly service: DevelopmentalMilestoneService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createMilestoneSchema.parse(req.body);
    logger.info(`[developmentalMilestone.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    res.status(201).json({
      success: true,
      data: result.toJSON(),
      message: 'Marco criado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listMilestoneFiltersSchema.parse(req.query);
    logger.info(`[developmentalMilestone.list] userId=${userId}`);
    const results = await this.service.list(userId, parsed);
    res.status(200).json({
      success: true,
      data: results.map(m => m.toJSON()),
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[developmentalMilestone.getById] userId=${userId} id=${req.params.id}`);
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
    const parsed = updateMilestoneSchema.parse(req.body);
    logger.info(`[developmentalMilestone.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({
      success: true,
      data: result.toJSON(),
      message: 'Marco atualizado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[developmentalMilestone.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
