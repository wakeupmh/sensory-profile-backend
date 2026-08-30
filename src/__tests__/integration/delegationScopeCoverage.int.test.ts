/**
 * Guarda contra rot: a restrição de criança sob delegação vive dentro dos
 * construtores de SQL compartilhados, mas isso só protege as consultas que os
 * usam. Estes testes falham quando alguém escreve o predicado à mão de novo,
 * ou quando uma tabela com `child_id` fica de fora da lista.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { buildWhere, CHILD_SCOPED_TABLES, FilterSpec, scopedById } from 'infrastructure/repositories/queryUtils';
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

const MIDDLEWARE_DIR = join(__dirname, '../../interfaces/http/middleware');

/**
 * Tabelas que TÊM `child_id` e mesmo assim ficam DELIBERADAMENTE fora de
 * `CHILD_SCOPED_TABLES`. O comentário da lista promete que uma tabela nova ou
 * entra nela, ou fica de fora com um motivo — este é o lugar do motivo, para
 * que a exclusão seja uma decisão escrita e não um esquecimento silencioso.
 */
const TABLES_INTENTIONALLY_NOT_CHILD_SCOPED = new Map([
  [
    'care_team_members',
    // É a própria concessão, não um dado clínico da criança. A tabela não tem
    // coluna `user_id`: quem autoriza ali é `granted_by_user_id` (o dono, que
    // concede) e `member_user_id` (quem recebeu). Entrar na lista faria os
    // construtores emitirem `(user_id = ... OR child_id = ANY(...))` contra
    // uma coluna que não existe — SQL inválido — e, se existisse, deixaria
    // quem está numa equipe enxergar as concessões das outras.
    'ACL do care team: autorizada por granted_by_user_id/member_user_id, sem coluna user_id',
  ],
]);

describe('cobertura do escopo de delegação', () => {
  test('every table with a child_id column is declared child-scoped', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'child_id'`,
    );
    const missing = rows
      .map((r) => r.table_name)
      .filter((t) => !CHILD_SCOPED_TABLES.has(t) && !TABLES_INTENTIONALLY_NOT_CHILD_SCOPED.has(t));

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

/**
 * O predicado da criança sob delegação foi esquecido três vezes, sempre pelo
 * mesmo mecanismo: a autorização num lugar, a consulta noutro. A concessão do
 * care team é a mesma armadilha com outro nome, então ganha as mesmas guardas
 * — estruturais, não por string, porque a versão por string desta guarda
 * passava com 14 caminhos de escrita abertos.
 */
describe('cobertura do escopo do care team', () => {
  const CHILD = '11111111-1111-4111-8111-111111111111';
  const DISJUNCAO = 'id = $1 AND (user_id = $2 OR child_id = ANY($3::uuid[]))';

  /** Todos os `.ts` de produção, para as guardas que varrem a árvore inteira. */
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        out.push(...sourceFiles(full));
      } else if (entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  const SRC_DIR = join(__dirname, '../..');

  test('toda tabela child-scoped ganha a disjunção — nenhuma escapa por caso especial', () => {
    // Percorre a lista viva: uma tabela acrescentada amanhã já entra aqui, e
    // qualquer caso especial que a deixe de fora aparece pelo nome.
    runWithScope({ careTeamChildIds: [CHILD] }, () => {
      const semDisjuncao = [...CHILD_SCOPED_TABLES].filter(
        (table) => scopedById(table, 'x', 'u').where !== DISJUNCAO,
      );
      expect(semDisjuncao).toEqual([]);
    });
  });

  test('e nenhuma tabela child-scoped ganha a disjunção quando não há concessão', () => {
    runWithScope({ careTeamChildIds: [] }, () => {
      const comDisjuncao = [...CHILD_SCOPED_TABLES].filter((table) =>
        scopedById(table, 'x', 'u').where.includes('OR'),
      );
      expect(comDisjuncao).toEqual([]);
    });
  });

  test('a disjunção do dono não é escrita à mão em lugar nenhum', () => {
    // Se o predicado puder nascer fora de `queryUtils`, volta a haver duas
    // verdades sobre quem alcança o quê — e é sempre a segunda que fica para
    // trás quando a regra muda.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      if (file.endsWith(join('repositories', 'queryUtils.ts'))) continue;
      const flat = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
      if (/user_id = \$\S* OR child_id = ANY/.test(flat) || /child_id = ANY\S* OR user_id = \$/.test(flat)) {
        offenders.push(file.slice(SRC_DIR.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('nenhuma consulta resolve a concessão em linha', () => {
    // Resolver a concessão dentro da consulta significaria pendurar uma
    // subconsulta a `care_team_members` em cada uma das ~160 instruções do
    // app. A lista é resolvida UMA vez por requisição, no
    // `careTeamScopeMiddleware`, e é o único lugar que fala com essa tabela
    // fora do repositório dela.
    const RESOLVEDOR = join(MIDDLEWARE_DIR, 'careTeamScopeMiddleware.ts');
    const offenders: string[] = [];
    for (const dir of [REPO_DIR, SERVICE_DIR, MIDDLEWARE_DIR]) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
        const full = join(dir, file);
        if (full === RESOLVEDOR) continue;
        const src = readFileSync(full, 'utf8');
        // Uma instrução por template literal: se `care_team_members` aparece
        // junto de uma tabela child-scoped, é uma consulta a dados da criança
        // resolvendo a concessão por conta própria.
        for (const [statement] of src.matchAll(/`[^`]*`/g)) {
          if (!statement.includes('care_team_members')) continue;
          const tables = [...statement.matchAll(/(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)/g)].map((m) => m[1]);
          const child = tables.filter((t) => CHILD_SCOPED_TABLES.has(t));
          if (child.length > 0) offenders.push(`${file}: ${child.join(', ')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('toda listagem child-scoped que passa por buildWhere mapeia child_id', () => {
    // `buildWhere` não recebe o nome da tabela (a assinatura é fixa), então o
    // sinal de que a listagem é child-scoped é o `child_id` no mapping. Um
    // mapping sem ele não vaza nada — só faz o profissional convidado não ver
    // o que lhe foi concedido, que é o tipo de bug que ninguém reporta.
    const offenders: string[] = [];
    for (const file of readdirSync(REPO_DIR).filter((f) => f.startsWith('Pg') && f.endsWith('.ts'))) {
      const src = readFileSync(join(REPO_DIR, file), 'utf8');
      if (!src.includes('buildWhere(')) continue;
      const tables = [...src.matchAll(/(?:FROM|UPDATE|INTO)\s+([a-z_]+)/g)].map((m) => m[1]);
      if (!tables.some((t) => CHILD_SCOPED_TABLES.has(t))) continue;

      for (const [, mappingName] of src.matchAll(/buildWhere\([^;]*?,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) {
        const declaration = new RegExp(`const ${mappingName}[^=]*=\\s*\\{[^}]*\\}`).exec(src);
        if (!declaration || !/'child_id'/.test(declaration[0])) {
          offenders.push(`${file}: ${mappingName}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('a listagem com o mapping certo recebe mesmo a disjunção', () => {
    // A guarda acima é estrutural; esta confere que o acordo que ela guarda
    // produz o predicado esperado.
    const mapping: Record<string, FilterSpec> = { childId: ['child_id'] };
    runWithScope({ careTeamChildIds: [CHILD] }, () => {
      expect(buildWhere('u', undefined, mapping).where).toBe(
        '(user_id = $1 OR child_id = ANY($2::uuid[]))',
      );
    });
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
