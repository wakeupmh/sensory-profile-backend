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

  test('no repository hand-writes the id+user predicate that bypasses the scope', () => {
    // `WHERE id = $1 AND user_id = $2` é exatamente o que vazava: sob
    // delegação o user_id é o do DONO, então bastava saber o id de um
    // registro de outra criança.
    const offenders: string[] = [];
    for (const file of readdirSync(REPO_DIR).filter((f) => f.startsWith('Pg') && f.endsWith('.ts'))) {
      const src = readFileSync(join(REPO_DIR, file), 'utf8');
      if (/WHERE id = \$1 AND user_id = \$2/.test(src)) offenders.push(file);
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
