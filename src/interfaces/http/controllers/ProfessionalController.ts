import { Request, Response } from 'express';

import { ProfessionalService } from '../../../application/services/ProfessionalService';
import {
  createProfessionalSchema,
  updateProfessionalSchema,
  acceptInvitationSchema,
} from '../validations/professionalValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

export class ProfessionalController {
  constructor(private readonly service: ProfessionalService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[professional.list] owner=${userId}`);
    const items = await this.service.listForOwner(userId);
    jsonResponse(res, items.map((p) => p.toOwnerView()), 200, { count: items.length });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    const p = await this.service.getForOwner(id, userId);
    jsonResponse(res, p.toOwnerView());
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const payload = createProfessionalSchema.parse(req.body);
    logger.info(`[professional.create] owner=${userId}`);
    const p = await this.service.create(
      {
        name: payload.name,
        email: payload.email ?? null,
        profession: payload.profession ?? null,
      },
      userId
    );
    jsonResponse(res, p.toOwnerView(), 201, { message: 'Professional invitation created' });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    const payload = updateProfessionalSchema.parse(req.body);
    const p = await this.service.update(
      id,
      {
        name: payload.name,
        email: payload.email ?? null,
        profession: payload.profession ?? null,
      },
      userId
    );
    jsonResponse(res, p.toOwnerView(), 200, { message: 'Professional updated' });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    await this.service.remove(id, userId);
    jsonMessage(res, 'Professional deleted');
  });

  rotateInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    const p = await this.service.rotateInvitation(id, userId);
    jsonResponse(res, p.toOwnerView(), 200, { message: 'Invitation token rotated' });
  });

  acceptInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { token } = acceptInvitationSchema.parse(req.body);
    logger.info(`[professional.accept] acceptedBy=${userId}`);
    const p = await this.service.acceptInvitation(token, userId);
    jsonResponse(
      res,
      {
        id: p.id,
        name: p.name,
        profession: p.profession,
        acceptedAt: p.acceptedAt,
      },
      200,
      { message: 'Invitation accepted' }
    );
  });

  listMyIdentities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const items = await this.service.listMyProfessionalIdentities(userId);
    const data = items.map((p) => ({
      id: p.id,
      name: p.name,
      profession: p.profession,
      ownerUserId: p.ownerUserId,
      acceptedAt: p.acceptedAt,
    }));
    jsonResponse(res, data, 200, { count: data.length });
  });
}
