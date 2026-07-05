import { Request, Response } from 'express';
import { ProfessionalNoteService } from '../../../application/services/ProfessionalNoteService';
import { ProfessionalService } from '../../../application/services/ProfessionalService';
import { AccessLogService } from '../../../application/services/AccessLogService';
import {
  createProfessionalNoteSchema,
  updateProfessionalNoteSchema,
} from '../validations/professionalNoteValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

export class ProfessionalNoteController {
  constructor(
    private readonly service: ProfessionalNoteService,
    private readonly professionalService: ProfessionalService,
    private readonly accessLogService: AccessLogService,
  ) {}

  private async myProfessionalIds(userId: string): Promise<string[]> {
    const identities = await this.professionalService.listMyProfessionalIdentities(userId);
    return identities.map((p) => p.id);
  }

  // Professional side — POST /api/shared/children/:childId/notes
  create = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const parsed = createProfessionalNoteSchema.parse(req.body);
    const profIds = await this.myProfessionalIds(userId);

    logger.info(`[professionalNote.create] childId=${childId} author=${userId}`);
    const note = await this.service.create(
      { childId, ...parsed },
      profIds,
      userId,
    );

    await this.accessLogService.record({
      actorUserId: userId,
      professionalId: note.getProfessionalId(),
      childId,
      resourceType: 'professional_note',
      resourceId: note.getId(),
      action: 'write',
    });

    jsonResponse(res, note.toJSON(), 201, { message: 'Nota registrada com sucesso' });
  });

  // Professional side — GET /api/shared/children/:childId/notes (only their own notes)
  listMine = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    const notes = await this.service.listMineForChild(childId, profIds);
    jsonResponse(res, notes.map((n) => n.toJSON()), 200, { count: notes.length });
  });

  // Professional side — PATCH /api/shared/notes/:id
  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    assertValidId(id, 'note ID');
    const userId = requireUserId(req);
    const { content } = updateProfessionalNoteSchema.parse(req.body);
    const profIds = await this.myProfessionalIds(userId);
    const note = await this.service.update(id, content, profIds);
    jsonResponse(res, note.toJSON(), 200, { message: 'Nota atualizada com sucesso' });
  });

  // Professional side — DELETE /api/shared/notes/:id
  remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    assertValidId(id, 'note ID');
    const userId = requireUserId(req);
    const profIds = await this.myProfessionalIds(userId);
    await this.service.remove(id, profIds);
    res.status(204).send();
  });

  // Owner side — GET /api/children/:childId/notes (every professional's notes)
  listForOwner = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const notes = await this.service.listForOwner(childId, userId);
    jsonResponse(res, notes.map((n) => n.toJSON()), 200, { count: notes.length });
  });
}
