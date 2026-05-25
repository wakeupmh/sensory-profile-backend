import { Request, Response } from 'express';
import { ChildService } from '../../../application/services/ChildService';
import { ChildProfileService } from '../../../application/services/ChildProfileService';
import { createChildSchema, updateChildSchema, profileQuerySchema, timelineQuerySchema } from '../validations/childValidation';
import {
  NotFoundError,
  ConflictError,
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class ChildController {
  constructor(
    private readonly service: ChildService,
    private readonly profileService: ChildProfileService,
  ) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[child.list] userId=${userId}`);
    const children = await this.service.list(userId);
    jsonResponse(res, children.map(c => c.toJSON()));
  });

  get = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    logger.info(`[child.get] userId=${userId} id=${id}`);
    const child = await this.service.get(id, userId);
    if (!child) throw new NotFoundError('Child', id);
    jsonResponse(res, child.toJSON());
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const body = createChildSchema.parse(req.body);
    logger.info(`[child.create] userId=${userId} name=${body.name}`);
    const child = await this.service.create(userId, body);
    jsonResponse(res, child.toJSON(), 201);
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params;
    assertValidId(id);
    const body = updateChildSchema.parse(req.body);
    logger.info(`[child.update] userId=${userId} id=${id}`);
    const child = await this.service.update(id, userId, body);
    if (!child) throw new NotFoundError('Child', id);
    jsonResponse(res, child.toJSON());
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
    jsonResponse(res, profile);
  });

  getTimeline = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { childId } = req.params;
    assertValidId(childId);
    const { page, limit, from, to } = timelineQuerySchema.parse(req.query);
    logger.info(`[child.getTimeline] userId=${userId} childId=${childId} page=${page} limit=${limit}`);
    const result = await this.profileService.getTimeline(childId, userId, page, limit, from, to);
    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });
}
