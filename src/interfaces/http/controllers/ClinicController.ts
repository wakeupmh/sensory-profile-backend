import { Request, Response } from 'express';
import { ClinicService } from '../../../application/services/ClinicService';
import {
  createClinicSchema,
  inviteClinicMemberSchema,
  acceptClinicInvitationSchema,
} from '../validations/clinicValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireOwnUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

/**
 * Como na equipe de cuidado, tudo aqui usa `requireOwnUserId`.
 *
 * `requireUserId` resolve a delegação e devolveria o `sub` do DONO de uma
 * criança — que não tem nada a ver com administrar uma clínica. Trabalhar
 * numa clínica é sobre quem você é, não sobre por qual criança você entrou.
 */
export class ClinicController {
  constructor(private readonly service: ClinicService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { name } = createClinicSchema.parse(req.body);
    logger.info(`[clinic.create] by=${userId}`);
    const clinic = await this.service.create(name, userId);
    jsonResponse(res, clinic.toJSON(), 201, { message: 'Clínica criada' });
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const clinics = await this.service.listMine(userId);
    jsonResponse(res, clinics, 200, { count: clinics.length });
  });

  invite = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { clinicId } = req.params;
    assertValidId(clinicId, 'clinic ID');
    const payload = inviteClinicMemberSchema.parse(req.body);
    logger.info(`[clinic.invite] clinic=${clinicId} role=${payload.role} by=${userId}`);
    const member = await this.service.invite(clinicId, payload, userId);
    // Única resposta que carrega o token — daqui em diante ele não volta mais.
    jsonResponse(res, member.toInviteView(), 201, { message: 'Convite para a clínica criado' });
  });

  roster = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { clinicId } = req.params;
    assertValidId(clinicId, 'clinic ID');
    const entries = await this.service.listRoster(clinicId, userId);
    // `caseloadSize` é número. A clínica administra pessoas; quais crianças
    // cada profissional atende continua sendo entre ele e o responsável.
    jsonResponse(res, entries.map((e) => e.member.toRosterView(e.caseloadSize)), 200, {
      count: entries.length,
    });
  });

  revokeMember = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { clinicId, id } = req.params;
    assertValidId(clinicId, 'clinic ID');
    assertValidId(id, 'clinic member ID');
    logger.info(`[clinic.revokeMember] clinic=${clinicId} member=${id} by=${userId}`);
    await this.service.revokeMember(id, clinicId, userId);
    jsonMessage(res, 'Participação na clínica encerrada');
  });

  acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { token } = acceptClinicInvitationSchema.parse(req.body);
    logger.info(`[clinic.accept] acceptedBy=${userId}`);
    const member = await this.service.acceptInvitation(token, userId);
    jsonResponse(res, { id: member.getId(), clinicId: member.getClinicId(), role: member.getRole() }, 200, {
      message: 'Convite para a clínica aceito',
    });
  });
}
