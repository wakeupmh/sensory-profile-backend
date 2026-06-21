import { Request, Response } from 'express';

import { ProfessionalService } from '../../../application/services/ProfessionalService';
import { ResourceShareService } from '../../../application/services/ResourceShareService';
import { AnamneseRepository } from '../../../domain/repositories/AnamneseRepository';
import { AssessmentRepository } from '../../../domain/repositories/AssessmentRepository';
import { ResponseRepository } from '../../../domain/repositories/ResponseRepository';
import { NotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import logger from '../../../infrastructure/utils/logger';


/**
 * Read-only endpoints used by professionals to view resources that have been
 * shared with them. All access is gated by a JOIN on the share tables — a
 * 404 is returned if the calling user has no share grant for the resource,
 * regardless of whether the resource exists.
 */
export class SharedAccessController {
  constructor(
    private readonly professionalService: ProfessionalService,
    private readonly anamneseShareService: ResourceShareService,
    private readonly assessmentShareService: ResourceShareService,
    private readonly anamneseRepo: AnamneseRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly responseRepo: ResponseRepository
  ) {}

  private async myProfessionalIds(userId: string): Promise<string[]> {
    const identities = await this.professionalService.listMyProfessionalIdentities(userId);
    return identities.map((p) => p.id);
  }

  listSharedAnamneses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    if (profIds.length === 0) {
      res.status(200).json({ success: true, data: [], count: 0, timestamp: new Date().toISOString() });
      return;
    }

    const summaries = await this.anamneseShareService.listForProfessionalIds(profIds);
    const items = await Promise.all(
      summaries.map(async (s) => {
        const a = await this.anamneseRepo.findByIdAnyOwner(s.resourceId);
        if (!a) return null;
        return {
          id: a.id,
          childName: (a.child as { name?: string })?.name ?? '',
          caregiverName: (a.caregiver as { name?: string })?.name ?? '',
          sharedAt: s.sharedAt,
          createdAt: a.createdAt,
        };
      })
    );
    const data = items.filter((x): x is NonNullable<typeof x> => x !== null);
    res.status(200).json({
      success: true,
      data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  });

  getSharedAnamnese = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'anamnese ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);

    const ok = await this.anamneseShareService.hasAccess(id, profIds);
    if (!ok) throw new NotFoundError('Anamnese', id);

    const a = await this.anamneseRepo.findByIdAnyOwner(id);
    if (!a) throw new NotFoundError('Anamnese', id);

    logger.info(`[shared.anamnese.get] id=${id} reader=${userId}`);
    res.status(200).json({
      success: true,
      data: a.toJSON(),
      readOnly: true,
      timestamp: new Date().toISOString(),
    });
  });

  listSharedAssessments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    if (profIds.length === 0) {
      res.status(200).json({ success: true, data: [], count: 0, timestamp: new Date().toISOString() });
      return;
    }

    const summaries = await this.assessmentShareService.listForProfessionalIds(profIds);
    const items = await Promise.all(
      summaries.map(async (s) => {
        const a = await this.assessmentRepo.findByIdAnyOwner(s.resourceId);
        if (!a) return null;
        const withRelations = a as typeof a & {
          childName?: string;
          childAge?: number;
        };
        return {
          id: a.getId(),
          instrumentId: a.getInstrumentId(),
          childName: withRelations.childName ?? '',
          childAge: withRelations.childAge ?? null,
          assessmentDate: a.getAssessmentDate(),
          sharedAt: s.sharedAt,
        };
      })
    );
    const data = items.filter((x): x is NonNullable<typeof x> => x !== null);
    res.status(200).json({
      success: true,
      data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  });

  getSharedAssessment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'assessment ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);

    const ok = await this.assessmentShareService.hasAccess(id, profIds);
    if (!ok) throw new NotFoundError('Assessment', id);

    const assessment = await this.assessmentRepo.findByIdAnyOwner(id);
    if (!assessment) throw new NotFoundError('Assessment', id);

    const responses = await this.responseRepo.findByAssessmentId(id);

    logger.info(`[shared.assessment.get] id=${id} reader=${userId}`);
    res.status(200).json({
      success: true,
      data: {
        assessment,
        responses,
        responseCount: responses.length,
      },
      readOnly: true,
      timestamp: new Date().toISOString(),
    });
  });
}
