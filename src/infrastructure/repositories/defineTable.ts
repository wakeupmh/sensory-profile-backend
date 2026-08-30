import { buildWhere, CHILD_SCOPED_TABLES, FilterSpec, scopedById } from './queryUtils';

/**
 * UM descritor por entidade: a tabela e suas colunas declaradas uma única vez,
 * e os quatro usos saindo daí — mapeamento da linha, INSERT, UPDATE dinâmico e
 * o mapa de filtros da listagem.
 *
 * Antes cada repositório repetia o mesmo par campo↔coluna quatro vezes, em
 * quatro formas diferentes, e as cópias já divergiam: três listagens de tabela
 * child-scoped não passavam por `buildWhere`, então a concessão do care team
 * simplesmente não as alcançava. Divergência de cópia não falha — só para de
 * funcionar em silêncio.
 */

/**
 * Como a coluna se comporta num UPDATE gerado. É a distinção que os `if` à mão
 * codificavam e que não pode ser perdida:
 *
 * - `set-if-defined` ← `if (input.name !== undefined)`
 * - `clear-on-null`  ← `if ('dosage' in input)`, onde `null` EXPLÍCITO limpa
 *
 * Colapsar as duas faz "limpar o campo" parar de funcionar sem que nada falhe:
 * o PATCH devolve 200, o campo continua preenchido. `descriptorUpdateSemantics
 * .int.test.ts` prova as duas metades contra o banco de verdade.
 */
export type ColumnMode =
  /** Escrita no INSERT, nunca num UPDATE gerado (id, user_id, child_id, author_user_id). */
  | 'immutable'
  /** Campo obrigatório: o UPDATE só toca a coluna quando veio um valor. */
  | 'set-if-defined'
  /** Campo anulável: `null` explícito limpa a coluna; a chave ausente não a toca. */
  | 'clear-on-null'
  /** Preenchida pelo banco: entra no mapeamento e em mais nada (created_at, updated_at). */
  | 'generated';

export interface ColumnSpec<T = unknown, M extends ColumnMode = ColumnMode> {
  readonly column: string;
  readonly mode: M;
  /** Valor da linha do banco → valor da prop da entidade. */
  readonly read: (value: unknown) => T;
  /** Valor da aplicação → parâmetro da query (JSON.stringify e afins). */
  readonly write?: (value: unknown) => unknown;
  /** Sufixo do placeholder quando a coluna exige cast — `::jsonb`. */
  readonly cast?: string;
  /** Valor gravado no INSERT quando a entrada omite (ou anula) o campo. */
  readonly insertDefault?: unknown;
  /** Todo UPDATE gerado carimba esta coluna com CURRENT_TIMESTAMP. */
  readonly touchOnUpdate?: boolean;
}

export type Columns = Record<string, ColumnSpec<unknown, ColumnMode>>;

type PropOf<S> = S extends ColumnSpec<infer T, ColumnMode> ? T : never;

/** Props da entidade reconstruídas a partir das colunas declaradas. */
export type RowProps<C extends Columns> = { [K in keyof C]: PropOf<C[K]> };

/**
 * Forma que o objeto de colunas precisa ter para cobrir `Props` EXATAMENTE.
 * Usado com `satisfies` no descritor: uma prop sem coluna e uma coluna sem prop
 * viram erro de compilação, que é a única forma de o mapeamento não envelhecer.
 */
export type ColumnsFor<Props> = { [K in keyof Props]-?: ColumnSpec<Props[K], ColumnMode> };

type WritableKeys<C extends Columns> = {
  [K in keyof C]: C[K]['mode'] extends 'generated' ? never : K;
}[keyof C];

type UpdatableKeys<C extends Columns> = {
  [K in keyof C]: C[K]['mode'] extends 'immutable' | 'generated' ? never : K;
}[keyof C];

export type InsertInput<C extends Columns> = { [K in WritableKeys<C>]?: PropOf<C[K]> };
export type UpdateInput<C extends Columns> = { [K in UpdatableKeys<C>]?: PropOf<C[K]> };

export interface Statement {
  readonly sql: string;
  readonly params: unknown[];
}

/** Leitores de coluna: onde mora a conversão de tipo que os `mapRow*` faziam à mão. */
export const read = {
  text: (value: unknown): string => value as string,
  textOrNull: (value: unknown): string | null => (value as string | null) ?? null,
  /** `numeric` e `bigint` chegam do pg como string — daí o `Number`. */
  number: (value: unknown): number => Number(value),
  numberOrNull: (value: unknown): number | null => (value == null ? null : Number(value)),
  boolean: (value: unknown): boolean => value as boolean,
  timestamp: (value: unknown): Date => new Date(value as string),
  timestampOrNull: (value: unknown): Date | null =>
    value == null ? null : new Date(value as string),
  /**
   * Valor entregue como o pg o devolve, tipado pelo domínio: enums, `jsonb`
   * tipado e as colunas `date`.
   *
   * As colunas `date` merecem um aviso: o pg as devolve como `Date`, e várias
   * props as declaram `string` (`diagnosisDate`, `achievedDate`, `targetDate`,
   * `followUpDate`, `startDate`, `endDate`, `reviewDate`). O tipo mente desde
   * antes deste descritor; `formatDateString` existe para resolver isso e só é
   * usado em `children.birth_date`. Aqui o comportamento é preservado LETRA POR
   * LETRA de propósito — corrigir muda a resposta da API, e isso é decisão de
   * quem cuida das entidades, não deste refactor.
   */
  raw:
    <T>() =>
    (value: unknown): T =>
      value as T,
  rawOrNull:
    <T>() =>
    (value: unknown): T | null =>
      (value as T | null) ?? null,
};

interface ColumnOptions<T> {
  /** Valor gravado no INSERT quando a entrada não traz (ou anula) o campo. */
  insertDefault?: T;
  /** Conversão do valor da aplicação para o parâmetro. */
  write?: (value: T) => unknown;
  /** Sufixo do placeholder quando a coluna exige cast — `::jsonb`. */
  cast?: string;
}

function build<T, M extends ColumnMode>(
  column: string,
  mode: M,
  reader: (value: unknown) => T,
  options: ColumnOptions<T>,
): ColumnSpec<T, M> {
  return {
    column,
    mode,
    read: reader,
    write: options.write as ((value: unknown) => unknown) | undefined,
    cast: options.cast,
    insertDefault: options.insertDefault,
  };
}

export const col = {
  /** Escrita no INSERT e nunca mais: id, user_id, child_id, author_user_id. */
  immutable<T>(
    column: string,
    reader: (value: unknown) => T,
    options: ColumnOptions<T> = {},
  ): ColumnSpec<T, 'immutable'> {
    return build(column, 'immutable', reader, options);
  },

  /** Campo obrigatório: o UPDATE só toca a coluna quando veio um valor. */
  required<T>(
    column: string,
    reader: (value: unknown) => T,
    options: ColumnOptions<T> = {},
  ): ColumnSpec<T, 'set-if-defined'> {
    return build(column, 'set-if-defined', reader, options);
  },

  /** Campo anulável: `null` EXPLÍCITO limpa a coluna; a chave ausente não a toca. */
  nullable<T>(
    column: string,
    reader: (value: unknown) => T | null,
    options: ColumnOptions<T | null> = {},
  ): ColumnSpec<T | null, 'clear-on-null'> {
    return build<T | null, 'clear-on-null'>(column, 'clear-on-null', reader, options);
  },

  /** Preenchida pelo banco; entra no mapeamento e em mais nada. */
  generated<T>(column: string, reader: (value: unknown) => T): ColumnSpec<T, 'generated'> {
    return build(column, 'generated', reader, {});
  },

  createdAt(column = 'created_at'): ColumnSpec<Date, 'generated'> {
    return build(column, 'generated', read.timestamp, {});
  },

  /** Como `createdAt`, mas todo UPDATE gerado a carimba. */
  updatedAt(column = 'updated_at'): ColumnSpec<Date, 'generated'> {
    return { ...build(column, 'generated', read.timestamp, {}), touchOnUpdate: true };
  },
};

export interface TableSpec<C extends Columns> {
  readonly table: string;
  readonly columns: C;
  /**
   * Mapa de filtros da listagem, no formato que `buildWhere` já consome. Vazio
   * quando a tabela não tem listagem genérica (a busca é por outra chave).
   */
  readonly filters?: Record<string, FilterSpec>;
}

/**
 * A parte do descritor que não depende dos tipos da entidade — é por aqui que
 * as guardas varrem o registro inteiro sem saber de que entidade se trata.
 */
export interface RegisteredTable {
  readonly table: string;
  readonly columns: Columns;
  readonly filters: Record<string, FilterSpec>;
  selectById(id: string, userId: string): Statement;
  update(id: string, userId: string, input: Record<string, unknown>): Statement | null;
  deleteById(id: string, userId: string): Statement;
}

export interface TableDescriptor<C extends Columns> extends RegisteredTable {
  readonly columns: C;

  /** Linha completa (`SELECT *`) → props da entidade. */
  mapRow(row: Record<string, unknown>): RowProps<C>;

  /** Só os campos pedidos, para as projeções de listagem. */
  pick<K extends keyof C>(
    row: Record<string, unknown>,
    fields: readonly K[],
  ): { [P in K]: PropOf<C[P]> };

  /** Lista de colunas de uma projeção, na ordem dos campos — o par de `pick`. */
  columnsOf(fields: readonly (keyof C)[]): string;

  /** `INSERT ... RETURNING *`, com a lista de colunas e os valores do descritor. */
  insert(input: InsertInput<C>): Statement;

  /** `SELECT * ... WHERE <escopo>`. */
  selectById(id: string, userId: string): Statement;

  /**
   * `UPDATE ... WHERE <escopo> RETURNING *`, ou `null` quando a entrada não
   * pede alteração nenhuma (o chamador cai no `findById`, como antes).
   */
  update(id: string, userId: string, input: UpdateInput<C>): Statement | null;

  /** `DELETE ... WHERE <escopo>`. */
  deleteById(id: string, userId: string): Statement;

  /**
   * WHERE da listagem, com o mapa de filtros declarado aqui. Aceita o objeto
   * de filtros tipado do domínio direto — o `as unknown as Record<...>` que
   * cada chamada de `buildWhere` repetia mora aqui dentro agora.
   */
  listWhere(
    userId: string,
    filters: object | undefined,
  ): { where: string; params: unknown[]; nextIndex: number };
}

const registry = new Map<string, RegisteredTable>();

/** Todos os descritores já carregados — as guardas varrem esta lista. */
export function registeredTables(): RegisteredTable[] {
  return [...registry.values()];
}

export function defineTable<C extends Columns>(spec: TableSpec<C>): TableDescriptor<C> {
  const { table } = spec;
  const filters = spec.filters ?? {};
  const entries = Object.entries(spec.columns) as [keyof C & string, ColumnSpec<unknown>][];

  const duplicated = entries
    .map(([, s]) => s.column)
    .filter((c, i, all) => all.indexOf(c) !== i);
  if (duplicated.length > 0) {
    throw new Error(`defineTable(${table}): coluna declarada duas vezes: ${duplicated.join(', ')}`);
  }

  // A listagem de uma tabela child-scoped que não mapeia `child_id` não vaza
  // nada — só faz o profissional convidado deixar de ver o que lhe foi
  // concedido, que é o tipo de bug que ninguém reporta. `buildWhere` decide se
  // a concessão entra olhando justamente para esse mapeamento.
  const listsWithoutChild =
    Object.keys(filters).length > 0 &&
    CHILD_SCOPED_TABLES.has(table) &&
    !Object.values(filters).some(([column]) => column === 'child_id');
  if (listsWithoutChild) {
    throw new Error(
      `defineTable(${table}): tabela child-scoped precisa mapear child_id nos filtros`,
    );
  }

  const insertable = entries.filter(([, s]) => s.mode !== 'generated');
  const updatable = entries.filter(([, s]) => s.mode !== 'generated' && s.mode !== 'immutable');
  const touched = entries.filter(([, s]) => s.touchOnUpdate).map(([, s]) => s.column);

  /** `null` nunca passa pelo `write`: SQL NULL não é o mesmo que o JSON `null`. */
  function toParam(column: ColumnSpec<unknown>, value: unknown): unknown {
    return value === null || column.write === undefined ? value : column.write(value);
  }

  const descriptor: TableDescriptor<C> = {
    table,
    columns: spec.columns,
    filters,

    mapRow(row) {
      const props: Record<string, unknown> = {};
      for (const [field, column] of entries) props[field] = column.read(row[column.column]);
      return props as RowProps<C>;
    },

    pick<K extends keyof C>(row: Record<string, unknown>, fields: readonly K[]) {
      const props: Record<string, unknown> = {};
      for (const field of fields) {
        const column = spec.columns[field];
        props[field as string] = column.read(row[column.column]);
      }
      return props as { [P in K]: PropOf<C[P]> };
    },

    columnsOf(fields) {
      return fields.map((field) => spec.columns[field].column).join(', ');
    },

    insert(input) {
      const columns: string[] = [];
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (const [field, column] of insertable) {
        // `?? insertDefault ?? null` reproduz o `input.x ?? null` /
        // `input.status ?? 'not_yet'` que cada save fazia à mão.
        const provided = (input as Record<string, unknown>)[field];
        const value = provided ?? column.insertDefault ?? null;
        params.push(toParam(column, value));
        columns.push(column.column);
        placeholders.push(`$${params.length}${column.cast ?? ''}`);
      }
      return {
        sql: `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
        params,
      };
    },

    selectById(id, userId) {
      const scope = scopedById(table, id, userId);
      return { sql: `SELECT * FROM ${table} WHERE ${scope.where}`, params: scope.params };
    },

    update(id, userId, input) {
      const setClauses: string[] = [];
      const params: unknown[] = [];
      const source = input as Record<string, unknown>;

      for (const [field, column] of updatable) {
        let value: unknown;
        if (column.mode === 'clear-on-null') {
          // A chave PRESENTE é o sinal, não o valor: `{ dosage: null }` limpa a
          // coluna, `{}` não a toca. Trocar isto por `!== undefined` faz o
          // caminho de limpar sumir sem que nada falhe.
          if (!(field in source)) continue;
          value = source[field] ?? null;
        } else {
          value = source[field];
          if (value === undefined) continue;
        }
        params.push(toParam(column, value));
        setClauses.push(`${column.column} = $${params.length}${column.cast ?? ''}`);
      }

      if (setClauses.length === 0) return null;
      for (const column of touched) setClauses.push(`${column} = CURRENT_TIMESTAMP`);

      // O predicado sai daqui, de `scopedById`, e não do repositório: um
      // repositório que usa o descritor não TEM como escrever o WHERE à mão, e
      // era exatamente por aí que a delegação vazava entre crianças.
      const scope = scopedById(table, id, userId, params.length + 1);
      params.push(...scope.params);

      return {
        sql: `UPDATE ${table}
       SET ${setClauses.join(', ')}
       WHERE ${scope.where}
       RETURNING *`,
        params,
      };
    },

    deleteById(id, userId) {
      const scope = scopedById(table, id, userId);
      return { sql: `DELETE FROM ${table} WHERE ${scope.where}`, params: scope.params };
    },

    listWhere(userId, listFilters) {
      return buildWhere(userId, listFilters as Record<string, unknown> | undefined, filters);
    },
  };

  // Dois descritores para a mesma tabela seriam duas verdades sobre as
  // colunas dela, e o registro guardaria só a última — as guardas passariam
  // verde vigiando a que não está em uso.
  if (registry.has(table)) {
    throw new Error(`defineTable(${table}): já existe um descritor para esta tabela`);
  }
  registry.set(table, descriptor);
  return descriptor;
}
