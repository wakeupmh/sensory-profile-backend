import { Request, Response } from 'express';
import { CareTeamService } from '../../../application/services/CareTeamService';
import {
  inviteCareTeamMemberSchema,
  acceptCareTeamInvitationSchema,
} from '../validations/careTeamValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireOwnUserId } from './controllerUtils';
import { jsonResponse, jsonMessage } from '../utils/response';
import logger from '../../../infrastructure/utils/logger';

/**
 * Todo endpoint aqui usa `requireOwnUserId`, nunca `requireUserId`.
 *
 * `requireUserId` resolve a delegação: sob `X-Delegate-Child-Id` ele devolve o
 * `sub` do DONO da criança, e é exatamente isso que não pode acontecer numa
 * rota que CONCEDE acesso. Com ele, um cuidador delegado — que recebeu acesso
 * a uma criança, não à conta — poderia convidar um profissional para a equipe
 * de uma criança que não é dele, e revogar quem o dono convidou. Conceder
 * acesso é ato do titular do dado. (É a assimetria que `ChildShareController`
 * ainda tem hoje, e que não se repete aqui.)
 *
 * Em `myChildren` a razão é a mesma por outro lado: sob delegação,
 * `requireUserId` devolveria o caseload do dono, não o de quem pediu.
 */
export class CareTeamController {
  constructor(private readonly service: CareTeamService) {}

  invite = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireOwnUserId(req);
    const { memberName, role } = inviteCareTeamMemberSchema.parse(req.body);
    logger.info(`[careTeam.invite] childId=${childId} role=${role} owner=${userId}`);
    const member = await this.service.invite(childId, { memberName, role }, userId);
    // Única resposta que carrega o token — daqui em diante ele não volta mais.
    jsonResponse(res, member.toOwnerView(), 201, { message: 'Convite para a equipe de cuidado criado' });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireOwnUserId(req);
    const members = await this.service.listForChild(childId, userId);
    jsonResponse(res, members.map((m) => m.toListView()), 200, { count: members.length });
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    const { childId, id } = req.params;
    assertValidId(childId, 'child ID');
    assertValidId(id, 'care team member ID');
    const userId = requireOwnUserId(req);
    logger.info(`[careTeam.revoke] childId=${childId} member=${id} owner=${userId}`);
    await this.service.revoke(id, childId, userId);
    jsonMessage(res, 'Participação na equipe de cuidado revogada');
  });

  acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const { token } = acceptCareTeamInvitationSchema.parse(req.body);
    logger.info(`[careTeam.accept] acceptedBy=${userId}`);
    const member = await this.service.acceptInvitation(token, userId);
    jsonResponse(res, { id: member.getId(), childId: member.getChildId(), role: member.getRole() }, 200, {
      message: 'Convite para a equipe de cuidado aceito',
    });
  });

  myChildren = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireOwnUserId(req);
    const children = await this.service.listMyChildren(userId);
    jsonResponse(res, children, 200, { count: children.length });
  });
}
