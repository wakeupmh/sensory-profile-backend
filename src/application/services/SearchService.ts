import { Pool } from 'pg';

export interface SearchChildResult {
  id: string;
  name: string;
}

export interface SearchLogResult {
  id: string;
  childId: string;
  childName: string;
  logType: string;
  occurredAt: string;
  notesSnippet: string;
}

export interface SearchDocumentResult {
  id: string;
  childId: string;
  childName: string;
  title: string;
  createdAt: string;
}

export interface SearchResults {
  children: SearchChildResult[];
  logs: SearchLogResult[];
  documents: SearchDocumentResult[];
}

const RESULTS_PER_CATEGORY = 8;
const NOTES_SNIPPET_LENGTH = 140;

// ILIKE treats %, _, and \ as special — escape them so a caregiver searching
// for a literal "50%" (e.g. "comeu 50% do prato") doesn't get treated as a
// wildcard pattern.
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Read-only free-text search across children, daily logs (notes field only —
 * the structured per-type `data` JSONB isn't indexed here), and documents.
 * No new table: this just runs three scoped ILIKE queries. Mirrors
 * BehaviorInsightsService's direct-Pool style since results are ad-hoc,
 * cross-table shapes rather than a persisted domain entity.
 */
export class SearchService {
  constructor(private readonly pool: Pool) {}

  async search(userId: string, query: string): Promise<SearchResults> {
    const pattern = `%${escapeLikePattern(query)}%`;

    const [childrenResult, logsResult, documentsResult] = await Promise.all([
      this.pool.query(
        `SELECT id, name
         FROM children
         WHERE user_id = $1 AND name ILIKE $2 ESCAPE '\\'
         ORDER BY name
         LIMIT $3`,
        [userId, pattern, RESULTS_PER_CATEGORY],
      ),
      this.pool.query(
        `SELECT dl.id, dl.child_id, c.name AS child_name, dl.log_type, dl.occurred_at, dl.notes
         FROM daily_logs dl
         JOIN children c ON c.id = dl.child_id
         WHERE dl.user_id = $1 AND dl.notes ILIKE $2 ESCAPE '\\'
         ORDER BY dl.occurred_at DESC
         LIMIT $3`,
        [userId, pattern, RESULTS_PER_CATEGORY],
      ),
      this.pool.query(
        `SELECT d.id, d.child_id, c.name AS child_name, d.title, d.created_at
         FROM documents d
         JOIN children c ON c.id = d.child_id
         WHERE d.user_id = $1 AND (d.title ILIKE $2 ESCAPE '\\' OR d.description ILIKE $2 ESCAPE '\\')
         ORDER BY d.created_at DESC
         LIMIT $3`,
        [userId, pattern, RESULTS_PER_CATEGORY],
      ),
    ]);

    return {
      children: childrenResult.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
      })),
      logs: logsResult.rows.map((row) => ({
        id: row.id as string,
        childId: row.child_id as string,
        childName: row.child_name as string,
        logType: row.log_type as string,
        occurredAt: (row.occurred_at as Date).toISOString(),
        notesSnippet: snippet(row.notes as string),
      })),
      documents: documentsResult.rows.map((row) => ({
        id: row.id as string,
        childId: row.child_id as string,
        childName: row.child_name as string,
        title: row.title as string,
        createdAt: (row.created_at as Date).toISOString(),
      })),
    };
  }
}

function snippet(text: string): string {
  if (text.length <= NOTES_SNIPPET_LENGTH) return text;
  return `${text.slice(0, NOTES_SNIPPET_LENGTH).trimEnd()}…`;
}
