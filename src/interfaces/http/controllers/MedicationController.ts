import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { AuthenticationError, ValidationError } from '../../../infrastructure/utils/errors/CustomErrors';
import logger from '../../../infrastructure/utils/logger';
import { MedicationService } from '../../../application/services/MedicationService';
import { createMedicationSchema, updateMedicationSchema, listMedicationFiltersSchema } from '../validations/medicalValidation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string | undefined): asserts id is string {
  if (!id || !UUID_REGEX.test(id)) throw new ValidationError('Invalid ID format');
}

function requireUserId(req: Request): string {
  if (!req.userId) throw new AuthenticationError();
  return req.userId;
}

export class MedicationController {
  constructor(private readonly service: MedicationService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = listMedicationFiltersSchema.parse(req.query);
    logger.info(`[medication.list] userId=${userId}`);
    const result = await this.service.list(userId, parsed);
    res.status(200).json({ success: true, data: result.map(m => m.toJSON()), timestamp: new Date().toISOString() });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medication.getById] userId=${userId} id=${req.params.id}`);
    const medication = await this.service.getById(req.params.id, userId);
    res.status(200).json({ success: true, data: medication.toJSON(), timestamp: new Date().toISOString() });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parsed = createMedicationSchema.parse(req.body);
    logger.info(`[medication.create] userId=${userId}`);
    const medication = await this.service.create(parsed, userId);
    res.status(201).json({ success: true, data: medication.toJSON(), message: 'Medicamento criado com sucesso', timestamp: new Date().toISOString() });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const parsed = updateMedicationSchema.parse(req.body);
    logger.info(`[medication.update] userId=${userId} id=${req.params.id}`);
    const medication = await this.service.update(req.params.id, parsed, userId);
    res.status(200).json({ success: true, data: medication.toJSON(), message: 'Medicamento atualizado com sucesso', timestamp: new Date().toISOString() });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    logger.info(`[medication.remove] userId=${userId} id=${req.params.id}`);
    await this.service.remove(req.params.id, userId);
    res.status(204).send();
  });
}
