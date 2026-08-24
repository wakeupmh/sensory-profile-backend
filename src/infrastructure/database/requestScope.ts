import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestScope {
  /**
   * Quando presente, a requisição chegou por delegação e só pode tocar dados
   * desta criança — mesmo que a consulta esteja escopada pelo `user_id` do
   * dono, que é o que a delegação resolve.
   */
  restrictedToChildId?: string;
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
 */
export function currentScope(): RequestScope {
  return storage.getStore() ?? {};
}

export function runWithScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, fn);
}
