/**
 * Traduz a URL de uma requisição no par (tipo de recurso, id do recurso) que
 * vai para `access_logs`.
 *
 * Existe porque a trilha de auditoria estava guardando a URL inteira em
 * `resource_type`, que é `VARCHAR(50)`: `delegated:PATCH:/api/daily-reports/`
 * mais um uuid dá 71 caracteres, o INSERT estourava com 22001 e
 * `AccessLogService.record` engolia o erro. O resultado é que justamente as
 * ações sobre UM registro — as que identificam o que foi lido ou alterado —
 * não deixavam rastro nenhum, enquanto as de coleção (URL curta) deixavam.
 *
 * O id do recurso tem coluna própria (`resource_id`) e estava sempre nulo
 * neste caminho, então a informação cabe sem esticar o schema.
 */
import { Request } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Largura de `access_logs.resource_type`. */
export const RESOURCE_TYPE_MAX_LENGTH = 50;

export interface AuditTarget {
  resourceType: string;
  resourceId: string | null;
}

/**
 * `/api/children/<uuid>/access-logs`  -> { access_logs, null }
 * `/api/daily-reports/<uuid>`         -> { daily_reports, <uuid> }
 * `/api/daily-reports/<uuid>/audio`   -> { daily_reports, <uuid> }
 * `/api/daily-logs`                   -> { daily_logs, null }
 *
 * O segmento `children/<uuid>` é descartado: a criança já vai em `child_id`,
 * repeti-la aqui só gastaria o espaço que o recurso de verdade precisa.
 */
export function auditTargetFromPath(req: Request): AuditTarget {
  const segments = `${req.baseUrl}${req.path}`.split('/').filter(Boolean);
  if (segments[0] === 'api') segments.shift();
  if (segments[0] === 'children') {
    segments.shift();
    if (segments[0] && UUID_REGEX.test(segments[0])) segments.shift();
  }

  const collection = segments.find((s) => !UUID_REGEX.test(s));
  const resourceId = segments.find((s) => UUID_REGEX.test(s)) ?? null;

  return {
    resourceType: normalize(collection ?? 'unknown'),
    resourceId,
  };
}

function normalize(segment: string): string {
  // `daily-reports` -> `daily_reports`, para casar com os valores que os
  // controllers já gravam à mão (`professional_note`, `anamnese`, ...).
  return segment.toLowerCase().replace(/-/g, '_').slice(0, RESOURCE_TYPE_MAX_LENGTH);
}
