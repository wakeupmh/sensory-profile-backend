import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { SchoolCommunicationService } from '../../../application/services/SchoolCommunicationService';
import {
  createSchoolCommSchema,
  updateSchoolCommSchema,
  listSchoolCommFiltersSchema,
} from '../validations/educationValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class SchoolCommunicationController {
  constructor(private readonly service: SchoolCommunicationService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createSchoolCommSchema.parse(req.body);
    logger.info(`[schoolCommunication.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    jsonResponse(res, result.toJSON(), 201, { message: 'Comunicação escolar criada com sucesso' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listSchoolCommFiltersSchema.parse(req.query);
    logger.info(`[schoolCommunication.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[schoolCommunication.getById] userId=${userId} id=${req.params.id}`);
    const result = await this.service.getById(req.params.id, userId);
    jsonResponse(res, result.toJSON());
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateSchoolCommSchema.parse(req.body);
    logger.info(`[schoolCommunication.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, result.toJSON(), 200, { message: 'Comunicação escolar atualizada com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[schoolCommunication.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
