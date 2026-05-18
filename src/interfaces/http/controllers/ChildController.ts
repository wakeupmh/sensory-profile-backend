import { Request, Response } from 'express';
import { ChildService } from '../../../application/services/ChildService';
import { createChildSchema, updateChildSchema } from '../validations/childValidation';
import {
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class ChildController {
  constructor(private readonly service: ChildService) {}

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
}
