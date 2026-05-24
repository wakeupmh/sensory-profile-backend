import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { CommunicationLogService } from '../../../application/services/CommunicationLogService';
import {
  createCommunicationLogSchema,
  updateCommunicationLogSchema,
  listCommunicationLogFiltersSchema,
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

export class CommunicationLogController {
  constructor(private readonly service: CommunicationLogService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createCommunicationLogSchema.parse(req.body);
    logger.info(`[communicationLog.create] userId=${userId}`);
    const result = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );
    res.status(201).json({
      success: true,
      data: result.toJSON(),
      message: 'Registro de comunicação criado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listCommunicationLogFiltersSchema.parse(req.query);
    logger.info(`[communicationLog.list] userId=${userId}`);
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
    logger.info(`[communicationLog.getById] userId=${userId} id=${req.params.id}`);
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
    const parsed = updateCommunicationLogSchema.parse(req.body);
    logger.info(`[communicationLog.update] userId=${userId} id=${req.params.id}`);
    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };
    const result = await this.service.update(req.params.id, payload, userId);
    res.status(200).json({
      success: true,
      data: result.toJSON(),
      message: 'Registro de comunicação atualizado com sucesso',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[communicationLog.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
