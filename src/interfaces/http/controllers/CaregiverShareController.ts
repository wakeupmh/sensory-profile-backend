import { Request, Response } from 'express';
import { CaregiverShareService } from '../../../application/services/CaregiverShareService';
import { inviteCaregiverSchema, acceptCaregiverInvitationSchema } from '../validations/caregiverShareValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireOwnUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

export class CaregiverShareController {
  constructor(private readonly service: CaregiverShareService) {}

  invite = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireOwnUserId(req);
    const { caregiverName } = inviteCaregiverSchema.parse(req.body);
    logger.info(`[caregiverShare.invite] childId=${childId} owner=${userId}`);
    const share = await this.service.invite(childId, caregiverName, userId);
    jsonResponse(res, share.toOwnerView(), 201, { message: 'Convite de cuidador criado' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireOwnUserId(req);
    const shares = await this.service.listForChild(childId, userId);
    jsonResponse(res, shares.map((s) => s.toListView()), 200, { count: shares.length });
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    const { childId, id } = req.params;
    assertValidId(childId, 'child ID');
    assertValidId(id, 'caregiver share ID');
    const userId = requireOwnUserId(req);
    await this.service.revoke(id, userId);
    jsonMessage(res, 'Compartilhamento com cuidador revogado');
  });

  acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { token } = acceptCaregiverInvitationSchema.parse(req.body);
    logger.info(`[caregiverShare.accept] acceptedBy=${userId}`);
    const share = await this.service.acceptInvitation(token, userId);
    jsonResponse(res, { id: share.getId(), childId: share.getChildId() }, 200, {
      message: 'Convite de cuidador aceito',
    });
  });
}
