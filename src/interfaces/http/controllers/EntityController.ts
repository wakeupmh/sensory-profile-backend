import { Request, Response } from 'express';
import { ChildService } from '../../../application/services/ChildService';
import { ExaminerService } from '../../../application/services/ExaminerService';
import { CaregiverService } from '../../../application/services/CaregiverService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { NotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class EntityController {
  constructor(
    private childService: ChildService,
    private examinerService: ExaminerService,
    private caregiverService: CaregiverService
  ) {}

  getAllChildren = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const children = await this.childService.getAllChildren(userId);
    jsonResponse(res, children);
  });

  getChildById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const child = await this.childService.getChildById(req.params.id, userId);

    if (!child) {
      throw new NotFoundError('Criança', req.params.id);
    }

    jsonResponse(res, child);
  });

  getAllExaminers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const examiners = await this.examinerService.getAllExaminers(userId);
    jsonResponse(res, examiners);
  });

  getExaminerById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const examiner = await this.examinerService.getExaminerById(req.params.id, userId);

    if (!examiner) {
      throw new NotFoundError('Examinador', req.params.id);
    }

    jsonResponse(res, examiner);
  });

  getAllCaregivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const caregivers = await this.caregiverService.getAllCaregivers(userId);
    jsonResponse(res, caregivers);
  });

  getCaregiverById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const caregiver = await this.caregiverService.getCaregiverById(req.params.id, userId);

    if (!caregiver) {
      throw new NotFoundError('Cuidador', req.params.id);
    }

    jsonResponse(res, caregiver);
  });
}
