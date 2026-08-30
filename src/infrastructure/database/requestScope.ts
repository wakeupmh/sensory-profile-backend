import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestScope {
  /**
   * Quando presente, a requisição chegou por delegação e só pode tocar dados
   * desta criança — mesmo que a consulta esteja escopada pelo `user_id` do
   * dono, que é o que a delegação resolve.
   */
  restrictedToChildId?: string;

  /**
   * Quem está REALMENTE agindo, mesmo quando as consultas correm sob o
   * `user_id` de outra pessoa (o dono da criança). É daqui que sai a autoria
   * (`author_user_id`): o dado continua sendo do responsável, mas quem
   * escreveu foi quem escreveu.
   */
  actingUserId?: string;

  /**
   * Crianças que o autor da requisição alcança por CONCESSÃO do care team —
   * convites aceitos e não revogados, resolvidos UMA vez por requisição pelo
   * `careTeamScopeMiddleware`. Resolver por consulta significaria pendurar uma
   * subconsulta a `care_team_members` em cada uma das ~160 instruções.
   *
   * Ausente ou vazio é o caso da esmagadora maioria: responsável sem equipe.
   * Nesse caso os construtores de SQL não mudam UMA LETRA do que emitem hoje.
   */
  careTeamChildIds?: string[];
}

const storage = new AsyncLocalStorage<RequestScope>();

/**
 * Escopo da requisição corrente, lido pelos construtores de SQL compartilhados.
 *
 * Por que contexto implícito e não um parâmetro: a restrição precisa valer em
 * TODA consulta, e passá-la à mão por 20 repositórios significa que a próxima
 * consulta escrita — daqui a um ano, por outra pessoa — vale por quem lembrou.
 * Foi exatamente assim que a delegação vazou: a verificação existia num lugar
 * e as consultas em outro. Aqui ela vive dentro do próprio construtor de SQL,
 * e um teste-guarda impede que alguém escreva a consulta à mão e escape.
 *
 * O `AsyncLocalStorage` propaga por await/promise sem esforço, então o escopo
 * segue a requisição por toda a cadeia assíncrona.
 *
 * Como `restrictedToChildId` (delegação) e `careTeamChildIds` (care team)
 * convivem: são mecanismos diferentes e podem estar ativos ao mesmo tempo. A
 * regra é que a DELEGAÇÃO ESTREITA, NUNCA ALARGA — uma requisição delegada
 * fica presa à sua única criança mesmo que quem chama também tenha concessões.
 * Quem manda `X-Delegate-Child-Id` está dizendo "estou agindo por esta
 * criança", e as consultas passam a correr sob o `user_id` do DONO dela; as
 * linhas dessa criança já pertencem a esse dono, então a disjunção da
 * concessão não alcançaria uma linha sequer a mais — só acrescentaria um `OR`
 * e um parâmetro a cada consulta, e uma segunda forma de o predicado do dono
 * afrouxar. Por isso, sob delegação, a concessão simplesmente não entra: o SQL
 * emitido é idêntico ao de hoje. A decisão vive nos construtores de SQL
 * (`queryUtils.ts`), num único lugar, e não em cada chamada.
 */
export function currentScope(): RequestScope {
  return storage.getStore() ?? {};
}

export function runWithScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, fn);
}
