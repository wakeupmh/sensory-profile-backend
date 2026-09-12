import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { ClinicController } from '../controllers/ClinicController';
import { ClinicService } from '../../../application/services/ClinicService';
import { PgClinicRepository } from '../../../infrastructure/repositories/PgClinicRepository';

const controller = new ClinicController(new ClinicService(new PgClinicRepository()));

/**
 * Sem `delegationMiddleware` e sem `careTeamScopeMiddleware`, de propósito.
 *
 * Nenhuma rota daqui toca dado de criança, então não há escopo de criança a
 * resolver — e montar o middleware de concessão aqui sugeriria que há. A
 * clínica não é caminho de acesso a dado; `clinicScopeIsolation.int.test.ts`
 * cobra isso.
 */
const router = Router();
router.use(authMiddleware);

router.post('/', controller.create.bind(controller));
router.get('/mine', controller.listMine.bind(controller));
router.post('/accept', controller.acceptInvitation.bind(controller));

router.post('/:clinicId/members', controller.invite.bind(controller));
router.get('/:clinicId/members', controller.roster.bind(controller));
router.delete('/:clinicId/members/:id', controller.revokeMember.bind(controller));

export default router;
