import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { SchoolCommunicationService } from '../../../application/services/SchoolCommunicationService';
import {
  createSchoolCommSchema,
  updateSchoolCommSchema,
  listSchoolCommFiltersSchema,
} from '../validations/educationValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!(req as any).userId) throw new AuthenticationError();
  return (req as any).userId;
}

export class SchoolCommunicationController {
  constructor(private readonly service: SchoolCommunicationService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createSchoolCommSchema.parse(req.body);
    logger.info(`[schoolCommunication.create] userId=${userId}`);
    const result = await this.service.create(parsed, userId);
    res.status(201).json({
      success: true,
      data: result.toJSON(),
      message: 'Comunicação escolar criada com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listSchoolCommFiltersSchema.parse(req.query);
    logger.info(`[schoolCommunication.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[schoolCommunication.getById] userId=${userId} id=${req.params.id}`);
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
    const parsed = updateSchoolCommSchema.parse(req.body);
    logger.info(`[schoolCommunication.update] userId=${userId} id=${req.params.id}`);
    const result = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({
      success: true,
      data: result.toJSON(),
      message: 'Comunicação escolar atualizada com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[schoolCommunication.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
