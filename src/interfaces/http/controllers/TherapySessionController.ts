import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { TherapySessionService } from '../../../application/services/TherapySessionService';
import { createSessionSchema, updateSessionSchema, listSessionFiltersSchema } from '../validations/therapySessionValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class TherapySessionController {
  constructor(private readonly service: TherapySessionService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listSessionFiltersSchema.parse(req.query);
    logger.info(`[therapySession.list] userId=${userId}`);
    const result = await this.service.list(userId, {
      ...parsed,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });
    res.status(200).json({ success: true, ...result, timestamp: new Date().toISOString() });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapySession.getById] userId=${userId} id=${req.params.id}`);
    const session = await this.service.getById(req.params.id, userId);
    res.status(200).json({ success: true, data: session, timestamp: new Date().toISOString() });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createSessionSchema.parse(req.body);
    logger.info(`[therapySession.create] userId=${userId}`);
    const session = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );
    res.status(201).json({ success: true, data: session, message: 'Sessão criada com sucesso', timestamp: new Date().toISOString() });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateSessionSchema.parse(req.body);
    logger.info(`[therapySession.update] userId=${userId} id=${req.params.id}`);
    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };
    const session = await this.service.update(req.params.id, payload, userId);
    res.status(200).json({ success: true, data: session, message: 'Sessão atualizada com sucesso', timestamp: new Date().toISOString() });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[therapySession.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
