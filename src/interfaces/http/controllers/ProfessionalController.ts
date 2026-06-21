import { Request, Response } from 'express';

import { ProfessionalService } from '../../../application/services/ProfessionalService';
import {
  createProfessionalSchema,
  updateProfessionalSchema,
  acceptInvitationSchema,
} from '../validations/professionalValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import logger from '../../../infrastructure/utils/logger';

export class ProfessionalController {
  constructor(private readonly service: ProfessionalService) {}

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    logger.info(`[professional.list] owner=${userId}`);
    const items = await this.service.listForOwner(userId);
    res.status(200).json({
      success: true,
      data: items.map((p) => p.toOwnerView()),
      count: items.length,
      timestamp: new Date().toISOString(),
    });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    const p = await this.service.getForOwner(id, userId);
    res.status(200).json({
      success: true,
      data: p.toOwnerView(),
      timestamp: new Date().toISOString(),
    });
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
    res.status(201).json({
      success: true,
      data: p.toOwnerView(),
      message: 'Professional invitation created',
      timestamp: new Date().toISOString(),
    });
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
    res.status(200).json({
      success: true,
      data: p.toOwnerView(),
      message: 'Professional updated',
      timestamp: new Date().toISOString(),
    });
  });

  remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    await this.service.remove(id, userId);
    res.status(200).json({
      success: true,
      message: 'Professional deleted',
      timestamp: new Date().toISOString(),
    });
  });

  rotateInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    assertValidId(id, 'professional ID');
    const userId = requireUserId(req);
    const p = await this.service.rotateInvitation(id, userId);
    res.status(200).json({
      success: true,
      data: p.toOwnerView(),
      message: 'Invitation token rotated',
      timestamp: new Date().toISOString(),
    });
  });

  acceptInvitation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { token } = acceptInvitationSchema.parse(req.body);
    logger.info(`[professional.accept] acceptedBy=${userId}`);
    const p = await this.service.acceptInvitation(token, userId);
    res.status(200).json({
      success: true,
      data: {
        id: p.id,
        name: p.name,
        profession: p.profession,
        acceptedAt: p.acceptedAt,
      },
      message: 'Invitation accepted',
      timestamp: new Date().toISOString(),
    });
  });

  listMyIdentities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const items = await this.service.listMyProfessionalIdentities(userId);
    res.status(200).json({
      success: true,
      data: items.map((p) => ({
        id: p.id,
        name: p.name,
        profession: p.profession,
        ownerUserId: p.ownerUserId,
        acceptedAt: p.acceptedAt,
      })),
      count: items.length,
      timestamp: new Date().toISOString(),
    });
  });
}
