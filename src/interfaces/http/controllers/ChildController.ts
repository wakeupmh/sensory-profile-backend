import { Request, Response } from 'express';
import { ChildService } from '../../../application/services/ChildService';
import { ChildProfileService } from '../../../application/services/ChildProfileService';
import { createChildSchema, updateChildSchema, profileQuerySchema, timelineQuerySchema } from '../validations/childValidation';
import {
  AuthenticationError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) {
    throw new ValidationError('Invalid ID format');
  }
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class ChildController {
  constructor(
    private readonly service: ChildService,
    private readonly profileService: ChildProfileService,
  ) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[child.list] userId=${userId}`);
    const children = await this.service.list(userId);
    res.status(200).json({
      success: true,
      data: children.map(c => c.toJSON()),
      timestamp: new Date().toISOString(),
    });
  });

  get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    logger.info(`[child.get] userId=${userId} id=${id}`);
    const child = await this.service.get(id, userId);
    if (!child) throw new NotFoundError('Child', id);
    res.status(200).json({
      success: true,
      data: child.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const body = createChildSchema.parse(req.body);
    logger.info(`[child.create] userId=${userId} name=${body.name}`);
    const child = await this.service.create(userId, body);
    res.status(201).json({
      success: true,
      data: child.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    const body = updateChildSchema.parse(req.body);
    logger.info(`[child.update] userId=${userId} id=${id}`);
    const child = await this.service.update(id, userId, body);
    if (!child) throw new NotFoundError('Child', id);
    res.status(200).json({
      success: true,
      data: child.toJSON(),
      timestamp: new Date().toISOString(),
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    logger.info(`[child.delete] userId=${userId} id=${id}`);
    const deleted = await this.service.delete(id, userId);
    if (deleted === false) {
      // repo returns false when child has assessments
      const child = await this.service.get(id, userId);
      if (!child) throw new NotFoundError('Child', id);
      throw new ConflictError(
        'Não é possível excluir esta criança pois ela possui avaliações associadas.',
        'Child'
      );
    }
    res.status(204).send();
  });

  getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId } = req.params;
    assertValidId(childId);
    const { periodDays } = profileQuerySchema.parse(req.query);
    logger.info(`[child.getProfile] userId=${userId} childId=${childId} periodDays=${periodDays}`);
    const profile = await this.profileService.getProfile(childId, userId, periodDays);
    res.status(200).json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  });

  getTimeline = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId } = req.params;
    assertValidId(childId);
    const { page, limit, from, to } = timelineQuerySchema.parse(req.query);
    logger.info(`[child.getTimeline] userId=${userId} childId=${childId} page=${page} limit=${limit}`);
    const result = await this.profileService.getTimeline(childId, userId, page, limit, from, to);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      timestamp: new Date().toISOString(),
    });
  });
}
