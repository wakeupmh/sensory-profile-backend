import { Router } from 'express';
import pool from '../../../infrastructure/database/connection';
import { authMiddleware } from '../middleware/authMiddleware';
import { createDelegationMiddleware } from '../middleware/delegationMiddleware';
import { careTeamScopeMiddleware } from '../middleware/careTeamScopeMiddleware';
import { CaregiverShareService } from '../../../application/services/CaregiverShareService';
import { PgCaregiverShareRepository } from '../../../infrastructure/repositories/PgCaregiverShareRepository';
import { AccessLogService } from '../../../application/services/AccessLogService';
import { PgAccessLogRepository } from '../../../infrastructure/repositories/PgAccessLogRepository';

/**
 * A delegação mora aqui, e não em `childRoutes`, porque ela só existe COMO
 * parte do encadeamento abaixo — e porque `childRoutes` também usa o
 * encadeamento. Deixar a instância lá e o encadeamento aqui faria os dois
 * módulos se importarem em ciclo, e um ciclo entre módulos que constroem
 * coisas na carga resolve pela ORDEM em que alguém importou primeiro: exato
 * tipo de coisa que passa verde no teste e explode no boot.
 *
 * Os dois serviços continuam exportados porque as rotas de convite, de
 * compartilhamento e de trilha de acesso trabalham sobre os mesmos objetos —
 * `childRoutes` os reexporta para não mudar o endereço de quem já os importa.
 */
const caregiverShareRepository = new PgCaregiverShareRepository();
export const caregiverShareService = new CaregiverShareService(caregiverShareRepository, pool);

const accessLogRepository = new PgAccessLogRepository();
export const accessLogService = new AccessLogService(accessLogRepository, pool);

export const delegationMiddleware = createDelegationMiddleware(caregiverShareService, accessLogService);

/**
 * Um `Router` já com o encadeamento das rotas de domínio — quer dizer, das
 * rotas que tocam dado de criança.
 *
 * ESTE é o único lugar do app onde a ordem dos três está escrita. Ela é
 * carregada e não é óbvia:
 *
 *  1. `authMiddleware` primeiro, porque os outros dois precisam de `req.userId`;
 *  2. `delegationMiddleware` depois, porque ele chama `runWithScope`, e o
 *     `AsyncLocalStorage` SUBSTITUI o store em vez de o fundir;
 *  3. `careTeamScopeMiddleware` por último, que funde o escopo que já existe
 *     (`{ ...currentScope() }`). Montado antes da delegação, o `actingUserId`
 *     daqui — que é a autoria — seria descartado sem quebrar nada visível.
 *
 * Antes isto era um ritual de três linhas repetido em treze arquivos, cobrado
 * por um teste que lia o código-fonte de todos eles. Um teste diz que a ordem
 * está certa; uma função faz com que não haja outra ordem para escrever. Quem
 * chama recebe o router com as três camadas JÁ montadas, então tudo o que for
 * registrado depois — rota ou sub-router — corre necessariamente atrás delas.
 *
 * Quem NÃO deve receber o encadeamento não chama esta função, e a recusa fica
 * escrita em `__tests__/careTeamScopeMounted.test.ts` com o motivo.
 */
export function domainRouter(): Router {
  const router = Router();
  router.use(authMiddleware);
  router.use(delegationMiddleware);
  router.use(careTeamScopeMiddleware);
  return router;
}
