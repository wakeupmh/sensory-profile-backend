import { Request, Response } from 'express';
import { ProfessionalService } from '../../../application/services/ProfessionalService';
import { ChildShareRepository } from '../../../domain/repositories/ChildShareRepository';
import { SharedChildDataService } from '../../../application/services/SharedChildDataService';
import { AccessLogService } from '../../../application/services/AccessLogService';
import { ChildShareScope } from '../../../domain/entities/ChildShare';
import { NotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

/**
 * Read-only endpoints for professionals viewing children shared with them at
 * the whole-child level (child_shares), as opposed to the per-resource
 * anamnese/assessment shares served by SharedAccessController. A 404 is
 * returned whenever the required scope is missing, hiding whether the child
 * exists at all. Every successful read is recorded to access_logs for the
 * owner's audit trail.
 */
export class SharedChildController {
  constructor(
    private readonly professionalService: ProfessionalService,
    private readonly childShareRepo: ChildShareRepository,
    private readonly dataService: SharedChildDataService,
    private readonly accessLogService: AccessLogService,
  ) {}

  private async myProfessionalIds(userId: string): Promise<string[]> {
    const identities = await this.professionalService.listMyProfessionalIdentities(userId);
    return identities.map((p) => p.id);
  }

  private async assertScope(childId: string, profIds: string[], scope: ChildShareScope): Promise<void> {
    const ok = await this.childShareRepo.hasScope(childId, profIds, scope);
    if (!ok) throw new NotFoundError('Criança', childId);
  }

  private async logRead(userId: string, childId: string, profIds: string[], resourceType: string): Promise<void> {
    const professionalId = await this.childShareRepo.resolveAccessProfessionalId(childId, profIds);
    await this.accessLogService.record({
      actorUserId: userId,
      professionalId,
      childId,
      resourceType,
      action: 'read',
    });
  }

  listSharedChildren = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    if (profIds.length === 0) {
      jsonResponse(res, [], 200, { count: 0 });
      return;
    }

    const access = await this.childShareRepo.listForProfessionalIds(profIds);
    const summaries = await this.dataService.getChildrenSummaries(access.map((a) => a.childId));

    const data = access
      .map((a) => {
        const summary = summaries.get(a.childId);
        if (!summary) return null;
        return { id: a.childId, name: summary.name, birthDate: summary.birthDate, scopes: a.scopes };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    jsonResponse(res, data, 200, { count: data.length });
  });

  getAssessments = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.assertScope(childId, profIds, 'assessments');
    logger.info(`[sharedChild.assessments] childId=${childId} reader=${userId}`);
    const rows = await this.dataService.getAssessments(childId);
    await this.logRead(userId, childId, profIds, 'child_assessments');
    jsonResponse(res, rows, 200, { count: rows.length });
  });

  getDailyLogs = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.assertScope(childId, profIds, 'daily_logs');
    logger.info(`[sharedChild.dailyLogs] childId=${childId} reader=${userId}`);
    const rows = await this.dataService.getDailyLogs(childId);
    await this.logRead(userId, childId, profIds, 'child_daily_logs');
    jsonResponse(res, rows, 200, { count: rows.length });
  });

  getTherapy = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.assertScope(childId, profIds, 'therapy');
    logger.info(`[sharedChild.therapy] childId=${childId} reader=${userId}`);
    const rows = await this.dataService.getTherapy(childId);
    await this.logRead(userId, childId, profIds, 'child_therapy');
    jsonResponse(res, rows, 200, { count: rows.length });
  });

  getMedical = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.assertScope(childId, profIds, 'medical');
    logger.info(`[sharedChild.medical] childId=${childId} reader=${userId}`);
    const data = await this.dataService.getMedical(childId);
    await this.logRead(userId, childId, profIds, 'child_medical');
    jsonResponse(res, data);
  });

  getDevelopment = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.assertScope(childId, profIds, 'development');
    logger.info(`[sharedChild.development] childId=${childId} reader=${userId}`);
    const data = await this.dataService.getDevelopment(childId);
    await this.logRead(userId, childId, profIds, 'child_development');
    jsonResponse(res, data);
  });
}
