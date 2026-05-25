import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { MedicationService } from '../../../application/services/MedicationService';
import { createMedicationSchema, updateMedicationSchema, listMedicationFiltersSchema } from '../validations/medicalValidation';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';

export class MedicationController {
  constructor(private readonly service: MedicationService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listMedicationFiltersSchema.parse(req.query);
    logger.info(`[medication.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    jsonResponse(res, result.map(m => m.toJSON()));
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medication.getById] userId=${userId} id=${req.params.id}`);
    const medication = await this.service.getById(req.params.id, userId);
    jsonResponse(res, medication.toJSON());
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createMedicationSchema.parse(req.body);
    logger.info(`[medication.create] userId=${userId}`);
    const medication = await this.service.create(parsed, userId);
    jsonResponse(res, medication.toJSON(), 201, { message: 'Medicamento criado com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateMedicationSchema.parse(req.body);
    logger.info(`[medication.update] userId=${userId} id=${req.params.id}`);
    const medication = await this.service.update(req.params.id, parsed, userId);
    jsonResponse(res, medication.toJSON(), 200, { message: 'Medicamento atualizado com sucesso' });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medication.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
