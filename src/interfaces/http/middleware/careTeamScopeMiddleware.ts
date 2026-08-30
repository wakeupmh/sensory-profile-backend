import { Request, Response, NextFunction } from 'express';
import pool from '../../../infrastructure/database/connection';
import { currentScope, RequestScope, runWithScope } from '../../../infrastructure/database/requestScope';
import logger from '../../../infrastructure/utils/logger';

/**
 * Só o que este middleware precisa de um pool — assim o teste passa um duplo
 * sem levantar Postgres, e a produção passa o pool de sempre.
 */
export interface CareTeamGrantSource {
  query(text: string, values: unknown[]): Promise<{ rows: Array<{ child_id: string }> }>;
}

/**
 * Concessões VIVAS de quem está chamando: convite aceito (`accepted_at`) e não
 * revogado (`revoked_at IS NULL`). A revogação é soft justamente para preservar
 * a trilha, então quem revoga continua na tabela — filtrar pelas duas colunas
 * é o que a torna imediata. O índice parcial de `care_team_members`
 * (`member_user_id` WHERE revoked_at IS NULL AND accepted_at IS NOT NULL) foi
 * feito para exatamente esta consulta.
 */
const GRANTS_SQL = `SELECT child_id FROM care_team_members
    WHERE member_user_id = $1
      AND accepted_at IS NOT NULL
      AND revoked_at IS NULL`;

/** `undefined_table` — a migration 035 ainda não correu neste banco. */
const UNDEFINED_TABLE = '42P01';

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * Resolve as crianças que quem chama alcança POR CONCESSÃO e corre o resto da
 * requisição dentro desse escopo.
 *
 * Por que aqui e não na consulta: a concessão é resolvida UMA vez por
 * requisição. A alternativa — cada consulta perguntando por conta própria —
 * penduraria uma subconsulta a `care_team_members` em cada uma das ~160
 * instruções do app, e, pior, seria mais um lugar de onde a autorização pode
 * ser esquecida. O predicado em si continua morando dentro de
 * `buildWhere`/`scopedById`: aqui só se descobre a lista, lá se aplica.
 *
 * O que este middleware NÃO faz:
 * - não recusa requisição nenhuma. Quem não tem concessão fica com a lista
 *   vazia, e o SQL emitido é IDÊNTICO ao de hoje — que é o caso da maioria
 *   das contas, responsáveis sem equipe;
 * - não decide quem é o dono do dado. `children.user_id` continua sendo o
 *   dono; a concessão é um acesso concedido por ele, e revogável por ele.
 *
 * Ordem de montagem: DEPOIS do `authMiddleware` (precisa de `req.userId`) e
 * DEPOIS do `createDelegationMiddleware`. A delegação chama `runWithScope` com
 * um escopo próprio, e o `AsyncLocalStorage` SUBSTITUI o store em vez de o
 * fundir — montado antes dela, o `actingUserId` daqui se perderia. Montado
 * depois, este middleware funde o que já existe (`{ ...currentScope() }`) e a
 * delegação continua valendo.
 */
export function createCareTeamScopeMiddleware(db: CareTeamGrantSource = pool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Sem identidade não há concessão a resolver; quem recusa é o
    // `authMiddleware`, não este.
    const memberUserId = req.userId;
    if (!memberUserId) return next();

    const inherited = currentScope();

    // Sob delegação a concessão não entra no predicado (a delegação estreita,
    // nunca alarga — ver `requestScope.ts`), então nem se consulta o banco:
    // seria uma ida a mais por requisição para um resultado que é descartado.
    const delegated = Boolean(inherited.restrictedToChildId ?? req.delegatedChildId);

    let careTeamChildIds: string[] = [];
    if (!delegated) {
      try {
        const { rows } = await db.query(GRANTS_SQL, [memberUserId]);
        careTeamChildIds = rows.map((row) => row.child_id);
      } catch (error) {
        // Falha fechada, e sem derrubar a requisição: sem lista, quem foi
        // convidado enxerga só o que já era dele. O erro NUNCA pode abrir
        // acesso, e uma falha ao ler `care_team_members` não pode tirar do ar
        // a conta de quem nem tem equipe.
        const level = pgCode(error) === UNDEFINED_TABLE ? 'debug' : 'warn';
        logger[level]('[careTeamScope] não foi possível resolver as concessões', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // `actingUserId` vai sempre: é a autoria, e vale mesmo sem concessão
    // nenhuma — inclusive sob delegação, onde as consultas correm sob o
    // `user_id` do dono e só este campo sabe quem de fato agiu.
    const scope: RequestScope = { ...inherited, actingUserId: memberUserId };

    // A lista só entra quando tem alguma coisa dentro. Presente e vazia ou
    // ausente dá no mesmo para os construtores de SQL, mas manter o campo
    // fora do escopo deixa isso explícito em quem inspeciona o escopo.
    if (careTeamChildIds.length > 0) {
      scope.careTeamChildIds = careTeamChildIds;
    }

    return runWithScope(scope, () => next());
  };
}

/** Instância pronta para montar, ligada ao pool da aplicação. */
export const careTeamScopeMiddleware = createCareTeamScopeMiddleware();
