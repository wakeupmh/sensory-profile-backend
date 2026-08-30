import { currentScope } from '../database/requestScope';

/**
 * Tabelas que têm coluna `child_id` e portanto podem — e devem — ser
 * restringidas quando a requisição chega por delegação. Lista explícita, e
 * não uma checagem em tempo de execução, para que uma tabela nova exija uma
 * decisão consciente; `delegationScopeCoverage.int.test.ts` compara esta
 * lista com o schema vivo e falha se alguma tabela com `child_id` ficar de
 * fora, do mesmo jeito que o teste de cobertura da eliminação faz.
 */
export const CHILD_SCOPED_TABLES = new Set([
  'access_logs',
  'ai_summaries',
  'caregiver_shares',
  'child_shares',
  'communication_logs',
  'comorbidities',
  'daily_logs',
  'daily_reports',
  'developmental_milestones',
  'documents',
  'education_plans',
  'goals',
  'medical_appointments',
  'medications',
  'professional_notes',
  'reminders',
  'report_shares',
  'school_communications',
  'sensory_assessments',
  'therapy_sessions',
]);

/**
 * Lista de crianças concedidas que DEVE entrar no predicado desta consulta —
 * ou `undefined` quando não entra nenhuma.
 *
 * É o único lugar onde a interação entre os dois mecanismos é decidida, para
 * que `buildWhere` e `scopedById` não possam divergir:
 *
 * - sem concessão (lista ausente ou vazia): `undefined`. É o caso do
 *   responsável sem equipe, e o SQL emitido continua sendo, letra por letra,
 *   o de antes do care team existir;
 * - tabela sem `child_id`: `undefined`. Não há o que conceder ali;
 * - sob delegação: `undefined`. A DELEGAÇÃO ESTREITA, NUNCA ALARGA — a
 *   requisição já está presa a uma única criança, cujas linhas pertencem ao
 *   dono sob o qual a consulta corre, então a disjunção não alcançaria nenhuma
 *   linha a mais; só afrouxaria o predicado do dono por nada.
 */
function grantedChildIds(childScoped: boolean): string[] | undefined {
  const { restrictedToChildId, careTeamChildIds } = currentScope();
  if (restrictedToChildId || !childScoped) return undefined;
  return careTeamChildIds && careTeamChildIds.length > 0 ? careTeamChildIds : undefined;
}

/**
 * Predicado do dono quando existe concessão: o registro é alcançável ou por
 * ser da conta de quem chama, ou por a criança estar entre as concedidas.
 * `ANY($n::uuid[])` mantém a lista inteira num único parâmetro — o número de
 * placeholders não varia com o tamanho da equipe.
 */
function ownerOrGranted(userIndex: number, grantsIndex: number): string {
  return `(user_id = $${userIndex} OR child_id = ANY($${grantsIndex}::uuid[]))`;
}

/**
 * Predicado para buscar/alterar UM registro pelo id, já com o escopo da
 * requisição aplicado.
 *
 * Escrever `WHERE id = $1 AND user_id = $2` à mão era o buraco: sob delegação
 * o `user_id` é o do DONO, então um cuidador convidado para uma criança
 * alcançava qualquer registro das outras crianças dele bastando saber o id.
 */
export function scopedById(
  table: string,
  id: string,
  userId: string,
  /** Primeiro placeholder livre, para queries cujo SET já ocupa $1, $2, ... */
  startIndex = 1,
): { where: string; params: unknown[]; nextIndex: number } {
  const { restrictedToChildId } = currentScope();
  const i = startIndex;
  const childScoped = CHILD_SCOPED_TABLES.has(table);
  if (restrictedToChildId && childScoped) {
    return {
      where: `id = $${i} AND user_id = $${i + 1} AND child_id = $${i + 2}`,
      params: [id, userId, restrictedToChildId],
      nextIndex: i + 3,
    };
  }
  // Concessão do care team: o profissional convidado não é o dono de linha
  // nenhuma, então sem esta disjunção ele não alcança o registro nem sabendo
  // o id — e com ela alcança SÓ as crianças concedidas. Vale para ler e para
  // escrever, porque é o mesmo predicado que o `update` e o `delete` usam.
  const granted = grantedChildIds(childScoped);
  if (granted) {
    return {
      where: `id = $${i} AND ${ownerOrGranted(i + 1, i + 2)}`,
      params: [id, userId, granted],
      nextIndex: i + 3,
    };
  }
  return { where: `id = $${i} AND user_id = $${i + 1}`, params: [id, userId], nextIndex: i + 2 };
}

/**
 * `children` é o caso que não cabe em `scopedById`: a criança é identificada
 * pela própria coluna `id`, não por `child_id`, então o predicado
 * "dono OU concedido" tem de casar por outra coluna.
 *
 * Vive à parte de propósito, e só é usado na LEITURA. `PgChildRepository` usa
 * `scopedById('children', ...)` também no DELETE — ensinar a concessão lá
 * dentro daria a um membro da equipe o poder de apagar a criança de uma
 * família. Leitura e destruição compartilham um helper hoje; a concessão
 * entra só de um lado, e é por isso que este helper existe em vez de uma
 * entrada em `CHILD_SCOPED_TABLES`.
 *
 * Sem concessão o SQL é idêntico ao de `scopedById('children', ...)`.
 */
export function scopedChildRead(
  id: string,
  userId: string,
): { where: string; params: unknown[] } {
  // Mesma decisão que `scopedById` toma (inclusive "sob delegação não entra"),
  // para que os dois não possam divergir.
  const grants = grantedChildIds(true);

  if (!grants) return { where: `id = $1 AND user_id = $2`, params: [id, userId] };
  return {
    where: `id = $1 AND (user_id = $2 OR id = ANY($3::uuid[]))`,
    params: [id, userId, grants],
  };
}

/**
 * Specification for a single filter field: which DB column and operator to use.
 * Defaults to `=` when operator is omitted.
 */
export type FilterSpec = [column: string, operator?: '>=' | '<=' | '='];

/**
 * Build a parameterised WHERE clause from userId + an optional filters object.
 *
 * @param userId   Always the first condition (`user_id = $1`).
 * @param filters  Object whose keys are looked up in `mapping` to produce conditions.
 * @param mapping  Maps filter-object keys → [sql_column, operator?].
 *                 Keys present in `mapping` but missing/undefined/null in `filters` are skipped.
 *                 Keys in `filters` that are NOT in `mapping` are ignored (e.g. `page`, `limit`).
 *
 * @returns `{ where, params, nextIndex }` ready to splice into a query.
 */
export function buildWhere(
  userId: string,
  filters: Record<string, unknown> | undefined,
  mapping: Record<string, FilterSpec>,
): { where: string; params: unknown[]; nextIndex: number } {
  const params: unknown[] = [userId];
  let idx = 2;

  // `buildWhere` não recebe o nome da tabela — e a assinatura é fixa, porque
  // 9 chamadas e ~20 repositórios dependem dela. O sinal de que a listagem é
  // child-scoped está no próprio mapping: uma listagem cuja tabela tem
  // `child_id` mapeia esse filtro (todas as 9 mapeiam). Se um dia alguma não
  // mapear, o efeito é a concessão NÃO entrar — quem foi convidado vê menos,
  // nunca mais. `delegationScopeCoverage.int.test.ts` guarda esse acordo.
  const mappingIsChildScoped = Object.values(mapping).some(([column]) => column === 'child_id');

  // Concessão do care team: o dono deixa de ser a única forma de alcançar a
  // linha. Um único parâmetro (`$2`), independentemente do tamanho da equipe.
  const granted = grantedChildIds(mappingIsChildScoped);
  const conditions: string[] = [granted ? ownerOrGranted(1, idx++) : 'user_id = $1'];
  if (granted) params.push(granted);

  // Sob delegação a listagem já vem com `childId` preenchido pelo middleware,
  // mas isso depende de a listagem ter esse filtro no mapping. Aplicar aqui
  // também fecha o caso de um mapping que não o tenha — a restrição passa a
  // ser propriedade do construtor de SQL, não de cada chamada.
  const { restrictedToChildId } = currentScope();
  if (restrictedToChildId && !mappingIsChildScoped) {
    conditions.push(`child_id = $${idx++}`);
    params.push(restrictedToChildId);
  }

  if (filters) {
    for (const [key, spec] of Object.entries(mapping)) {
      const val = filters[key];
      if (val !== undefined && val !== null) {
        const [column, operator = '='] = spec;
        conditions.push(`${column} ${operator} $${idx++}`);
        params.push(val);
      }
    }
  }

  return { where: conditions.join(' AND '), params, nextIndex: idx };
}
