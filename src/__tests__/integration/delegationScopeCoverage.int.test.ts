/**
 * Guarda contra rot: a restrição de criança sob delegação vive dentro dos
 * construtores de SQL compartilhados, mas isso só protege as consultas que os
 * usam. Estes testes falham quando alguém escreve o predicado à mão de novo,
 * ou quando uma tabela com `child_id` fica de fora da lista.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { CHILD_SCOPED_TABLES, scopedById } from 'infrastructure/repositories/queryUtils';
import { runWithScope } from 'infrastructure/database/requestScope';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => {
  await pool.end();
});

const REPO_DIR = join(__dirname, '../../infrastructure/repositories');
const SERVICE_DIR = join(__dirname, '../../application/services');

/**
 * Repositórios cuja autorização NÃO passa por `user_id`, e por isso não têm o
 * que `scopedById` faça por eles: `caregiver_shares` é gerido pelo dono
 * (`owner_user_id`) e `professional_notes` pelo autor (`professional_id`).
 * Ambas as tabelas têm `child_id`, então caem na lista de child-scoped —
 * a isenção é explícita para que ninguém a confunda com esquecimento.
 */
const REPOS_AUTHORIZED_BY_ANOTHER_COLUMN = new Set([
  'PgCaregiverShareRepository.ts',
  'PgProfessionalNoteRepository.ts',
]);

/**
 * Serviços que escrevem SQL direto e cuja tabela NÃO tem `child_id`
 * (`caregivers`, `examiners`, `voice_notes`) — não há o que restringir ali.
 */
const SERVICES_WITHOUT_CHILD_SCOPE = new Set([
  'CaregiverService.ts',
  'ExaminerService.ts',
  'VoiceNoteService.ts',
]);

describe('cobertura do escopo de delegação', () => {
  test('every table with a child_id column is declared child-scoped', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'child_id'`,
    );
    const missing = rows.map((r) => r.table_name).filter((t) => !CHILD_SCOPED_TABLES.has(t));

    // Uma tabela nova com child_id precisa de uma decisão consciente: ou entra
    // na lista, ou fica de fora com um motivo. O silêncio é o que vaza.
    expect(missing).toEqual([]);
  });

  test('no table is declared child-scoped that does not actually have the column', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'child_id'`,
    );
    const real = new Set(rows.map((r) => r.table_name));
    expect([...CHILD_SCOPED_TABLES].filter((t) => !real.has(t))).toEqual([]);
  });

  test('no service hand-writes the id+user predicate either', () => {
    // A primeira versão desta guarda só varria os repositórios, e vários
    // serviços falam com o banco diretamente — foi por essa fresta que
    // `daily_reports` continuou alcançável entre crianças depois do PR que
    // dizia ter fechado o caso do `:id`.
    const offenders: string[] = [];
    for (const file of readdirSync(SERVICE_DIR).filter((f) => f.endsWith('.ts'))) {
      if (SERVICES_WITHOUT_CHILD_SCOPE.has(file)) continue;
      const src = readFileSync(join(SERVICE_DIR, file), 'utf8');
      // `FROM children` é a checagem de posse da própria criança, não um
      // registro dela — não é o padrão que vaza.
      const lines = src.split('\n').filter((l) => /WHERE id = \$1 AND user_id = \$2/.test(l) && !/FROM children/.test(l));
      if (lines.length > 0) offenders.push(`${file}: ${lines.length}`);
    }
    expect(offenders).toEqual([]);
  });

  test('no repository addresses a row by id without going through the scope helper', () => {
    // A primeira versão desta guarda procurava a string LITERAL
    // `WHERE id = $1 AND user_id = $2`. Os métodos `update` montam o mesmo
    // predicado com placeholders dinâmicos — `$${params.length - 1}`, `$17` —
    // então a guarda passava com 14 caminhos de escrita abertos, e um cuidador
    // delegado à criança A conseguia editar registros da criança B.
    //
    // Agora a checagem é estrutural: QUALQUER `WHERE id = $...` num
    // repositório precisa vir de `scopedById` (ou seja, usar `scope.where`).
    // A forma do placeholder deixa de importar.
    const offenders: string[] = [];
    for (const file of readdirSync(REPO_DIR).filter((f) => f.startsWith('Pg') && f.endsWith('.ts'))) {
      if (REPOS_AUTHORIZED_BY_ANOTHER_COLUMN.has(file)) continue;
      const lines = readFileSync(join(REPO_DIR, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/WHERE\s+id\s*=\s*\$/.test(line) || /scope\.where/.test(line)) return;
        // Só interessa a tabela que a consulta toca: um `WHERE id = $1` em
        // `anamneses` ou `caregiver_shares` não tem `child_id` a restringir.
        const context = lines.slice(Math.max(0, i - 12), i + 1).join(' ');
        const matches = [...context.matchAll(/(?:FROM|UPDATE|INTO)\s+([a-z_]+)/g)];
        const table = matches.length > 0 ? matches[matches.length - 1][1] : undefined;
        if (table && CHILD_SCOPED_TABLES.has(table)) {
          offenders.push(`${file}:${i + 1}  (${table})  ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

});

describe('scopedById', () => {
  test('adds no child restriction outside a delegated request', () => {
    const scope = scopedById('daily_logs', 'log-1', 'owner-1');
    expect(scope.where).toBe('id = $1 AND user_id = $2');
    expect(scope.params).toEqual(['log-1', 'owner-1']);
  });

  test('restricts to the delegated child for a child-scoped table', () => {
    runWithScope({ restrictedToChildId: 'child-A' }, () => {
      const scope = scopedById('daily_logs', 'log-1', 'owner-1');
      expect(scope.where).toBe('id = $1 AND user_id = $2 AND child_id = $3');
      expect(scope.params).toEqual(['log-1', 'owner-1', 'child-A']);
    });
  });

  test('leaves tables without a child_id alone', () => {
    runWithScope({ restrictedToChildId: 'child-A' }, () => {
      // `therapists` é da conta, não da criança — acrescentar child_id ali
      // geraria SQL inválido.
      expect(scopedById('therapists', 't-1', 'owner-1').where).toBe('id = $1 AND user_id = $2');
    });
  });

  test('the scope survives the await chain, which is the whole point', async () => {
    await runWithScope({ restrictedToChildId: 'child-A' }, async () => {
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setTimeout(r, 1));
      expect(scopedById('documents', 'd-1', 'owner-1').params).toContain('child-A');
    });
  });
});
