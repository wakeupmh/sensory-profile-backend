/**
 * Base das entidades de domínio.
 *
 * O que ela resolve é a serialização. Vinte e tantas entidades escreviam um
 * `toJSON` que repetia, campo por campo, o próprio `Props` — e em onze delas
 * esse espelho tinha buracos DE PROPÓSITO: `Document` não devolve
 * `storageKey`, `PushSubscription` não devolve as chaves cripto,
 * `CaregiverShare` não devolve o token do convite na listagem. Cada omissão
 * dessas é uma propriedade de segurança escrita à mão, num método que parece
 * burocracia — exatamente o tipo de código que a próxima pessoa completa sem
 * pensar, acrescentando de volta o campo que faltava.
 *
 * Aqui a omissão vira declaração: a entidade diz o que esconde, o tipo de
 * retorno já sai sem esses campos, e `serialisationSafety.test.ts` varre todas
 * as entidades para garantir que nenhum segredo escapa por nenhuma view.
 *
 * O que ela NÃO faz é esconder o domínio. Os getters continuam em cada
 * entidade: são 186 chamadas espalhadas pelo app e é neles que mora o
 * vocabulário do domínio (`isActive()`, `isAccepted()`). Só o espelho
 * mecânico saiu.
 *
 * @typeParam P Os `Props` da entidade.
 * @typeParam H União dos campos escondidos, para o retorno de `toJSON` já
 *              nascer sem eles. O default `never` cobre o caso comum.
 */
export abstract class Entity<P extends object, H extends keyof P = never> {
  constructor(protected readonly props: P) {}

  /**
   * Campos que `toJSON` nunca devolve.
   *
   * Sobrescrever isto é a ÚNICA forma de esconder um campo — não existe um
   * `toJSON` escrito à mão para divergir do que está declarado aqui.
   */
  protected hiddenFields(): readonly H[] {
    return [];
  }

  toJSON(): Omit<P, H> {
    const out = { ...this.props };
    for (const field of this.hiddenFields()) delete out[field];
    return out as Omit<P, H>;
  }
}
