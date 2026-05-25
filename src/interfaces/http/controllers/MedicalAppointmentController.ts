import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { MedicalAppointmentService } from '../../../application/services/MedicalAppointmentService';
import { createAppointmentSchema, updateAppointmentSchema, listAppointmentFiltersSchema } from '../validations/medicalValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class MedicalAppointmentController {
  constructor(private readonly service: MedicalAppointmentService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listAppointmentFiltersSchema.parse(req.query);
    logger.info(`[medicalAppointment.list] userId=${userId}`);
    const result = await this.service.list(userId, {
      ...parsed,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    });
    jsonResponse(res, result.data, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medicalAppointment.getById] userId=${userId} id=${req.params.id}`);
    const appointment = await this.service.getById(req.params.id, userId);
    jsonResponse(res, appointment.toJSON());
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createAppointmentSchema.parse(req.body);
    logger.info(`[medicalAppointment.create] userId=${userId}`);
    const appointment = await this.service.create(
      { ...parsed, occurredAt: new Date(parsed.occurredAt) },
      userId,
    );
    jsonResponse(res, appointment.toJSON(), 201, { message: 'Consulta criada com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateAppointmentSchema.parse(req.body);
    logger.info(`[medicalAppointment.update] userId=${userId} id=${req.params.id}`);
    const payload = {
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    };
    const appointment = await this.service.update(req.params.id, payload, userId);
    jsonResponse(res, appointment.toJSON(), 200, { message: 'Consulta atualizada com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medicalAppointment.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
