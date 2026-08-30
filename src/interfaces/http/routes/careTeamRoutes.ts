import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { CareTeamController } from '../controllers/CareTeamController';
import { CareTeamService } from '../../../application/services/CareTeamService';
import { PgCareTeamMemberRepository } from '../../../infrastructure/repositories/PgCareTeamMemberRepository';
import { delegationMiddleware } from './childRoutes';
import pool from '../../../infrastructure/database/connection';

const repository = new PgCareTeamMemberRepository();
export const careTeamService = new CareTeamService(repository, pool);
const controller = new CareTeamController(careTeamService);

/**
 * As rotas da equipe de cuidado vivem em dois prefixos: as do responsável
 * penduram na criança (`/api/children/:childId/care-team`) e as do
 * profissional não (`/api/care-team`), porque quem aceita um convite ou abre o
 * próprio caseload ainda não tem criança nenhuma na mão. Como os dois prefixos
 * são irmãos, este router é montado em `/api` e declara o caminho inteiro de
 * cada rota; a autenticação vai por prefixo, com `router.use` COM caminho, para
 * não interceptar o resto de `/api`.
 *
 * A delegação entra só no ramo da criança, para alinhar com
 * `/api/children/:childId/caregivers`: assim uma requisição delegada é
 * recusada explicitamente (403 em `requireOwnUserId`) em vez de passar como se
 * o cabeçalho não existisse.
 */
const router = Router();
router.use('/children/:childId/care-team', authMiddleware, delegationMiddleware);
router.use('/care-team', authMiddleware);

router.post('/children/:childId/care-team', controller.invite.bind(controller));
router.get('/children/:childId/care-team', controller.list.bind(controller));
router.delete('/children/:childId/care-team/:id', controller.revoke.bind(controller));

router.post('/care-team/accept', controller.acceptInvitation.bind(controller));
router.get('/care-team/my-children', controller.myChildren.bind(controller));

export default router;
