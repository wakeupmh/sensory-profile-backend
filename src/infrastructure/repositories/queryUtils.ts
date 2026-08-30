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
  if (restrictedToChildId && CHILD_SCOPED_TABLES.has(table)) {
    return {
      where: `id = $${i} AND user_id = $${i + 1} AND child_id = $${i + 2}`,
      params: [id, userId, restrictedToChildId],
      nextIndex: i + 3,
    };
  }
  return { where: `id = $${i} AND user_id = $${i + 1}`, params: [id, userId], nextIndex: i + 2 };
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
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];
  let idx = 2;

  // Sob delegação a listagem já vem com `childId` preenchido pelo middleware,
  // mas isso depende de a listagem ter esse filtro no mapping. Aplicar aqui
  // também fecha o caso de um mapping que não o tenha — a restrição passa a
  // ser propriedade do construtor de SQL, não de cada chamada.
  const { restrictedToChildId } = currentScope();
  if (restrictedToChildId && !Object.values(mapping).some(([column]) => column === 'child_id')) {
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
