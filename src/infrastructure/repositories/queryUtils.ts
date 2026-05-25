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
