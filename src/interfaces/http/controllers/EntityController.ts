import { Request, Response } from 'express';
import { ChildService } from '../../../application/services/ChildService';
import { ExaminerService } from '../../../application/services/ExaminerService';
import { CaregiverService } from '../../../application/services/CaregiverService';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { NotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { assertValidId, requireUserId } from './controllerUtils';

export class EntityController {
  constructor(
    private childService: ChildService,
    private examinerService: ExaminerService,
    private caregiverService: CaregiverService
  ) {}

  getAllChildren = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const children = await this.childService.getAllChildren(userId);
    res.status(200).json(children);
  });

  getChildById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const child = await this.childService.getChildById(req.params.id, userId);

    if (!child) {
      throw new NotFoundError('Criança', req.params.id);
    }

    res.status(200).json(child);
  });

  getAllExaminers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const examiners = await this.examinerService.getAllExaminers(userId);
    res.status(200).json(examiners);
  });

  getExaminerById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const examiner = await this.examinerService.getExaminerById(req.params.id, userId);

    if (!examiner) {
      throw new NotFoundError('Examinador', req.params.id);
    }

    res.status(200).json(examiner);
  });

  getAllCaregivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const caregivers = await this.caregiverService.getAllCaregivers(userId);
    res.status(200).json(caregivers);
  });

  getCaregiverById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    assertValidId(req.params.id);
    const userId = requireUserId(req);
    const caregiver = await this.caregiverService.getCaregiverById(req.params.id, userId);

    if (!caregiver) {
      throw new NotFoundError('Cuidador', req.params.id);
    }

    res.status(200).json(caregiver);
  });
}
