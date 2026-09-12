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
import { RegisteredTable, registeredTables } from 'infrastructure/repositories/defineTable';
import { RequestScope, runWithScope } from 'infrastructure/database/requestScope';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => {
  await pool.end();
});

const REPO_DIR = join(__dirname, '../../infrastructure/repositories');
const SERVICE_DIR = join(__dirname, '../../application/services');

function repositoryFiles(): string[] {
  return readdirSync(REPO_DIR).filter((f) => f.startsWith('Pg') && f.endsWith('.ts'));
}

/**
 * Carrega todo `Pg*` para que os descritores de tabela se REGISTREM. As
 * guardas do descritor varrem o registro, e um repositório que não fosse
 * carregado sairia da varredura em silêncio — que é o modo de falhar contra o
 * qual elas existem. `o registro cobre todo repositório que declara um
 * descritor`, mais abaixo, confere que a carga foi completa.
 */
for (const file of repositoryFiles()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(join(REPO_DIR, file));
}

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

  test('toda listagem child-scoped mapeia child_id — no descritor ou no mapping local', () => {
    // `buildWhere` não recebe o nome da tabela (a assinatura é fixa), então o
    // sinal de que a listagem é child-scoped é o `child_id` no mapping. Um
    // mapping sem ele não vaza nada — só faz o profissional convidado não ver
    // o que lhe foi concedido, que é o tipo de bug que ninguém reporta.
    //
    // A varredura por fonte sozinha ficou CEGA quando os mapas passaram a
    // morar nos descritores: `buildWhere(userId, filters, TABLE.filters)` não
    // casa o padrão `buildWhere(..., NOME_DO_CONST)`, e a guarda passaria
    // verde sem olhar para mapa nenhum. Por isso a fonte da verdade agora é o
    // registro dos descritores, e o scan continua só para o que sobrou escrito
    // à mão.
    const offenders: string[] = [];

    for (const descriptor of registeredTables()) {
      if (!CHILD_SCOPED_TABLES.has(descriptor.table)) continue;
      // Mapa vazio = a tabela não tem listagem genérica (a busca é por outra
      // chave). Só o mapa PREENCHIDO que esquece o child_id é o problema.
      if (Object.keys(descriptor.filters).length === 0) continue;
      if (!Object.values(descriptor.filters).some(([column]) => column === 'child_id')) {
        offenders.push(`${descriptor.table}: filtros do descritor`);
      }
    }

    for (const file of repositoryFiles()) {
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

/**
 * As instruções que o descritor de tabela GERA.
 *
 * A guarda estrutural acima procura `WHERE id = $...` escrito num repositório.
 * Os repositórios convertidos não têm mais essa linha — o UPDATE e o DELETE
 * nascem em `defineTable`, num arquivo só, com o nome da tabela interpolado.
 * A varredura por fonte não alcança isso, e uma guarda que não alcança o
 * código que deveria vigiar é pior que nenhuma: passa verde e dá a impressão
 * de que alguém está olhando.
 *
 * Estas guardas não leem fonte: pedem ao descritor a instrução e comparam o
 * predicado, letra por letra, com o que `scopedById` produziria — nos três
 * escopos que existem. Tirar o `scopedById` do gerador quebra todas elas.
 */
describe('escopo das instruções geradas pelo descritor', () => {
  const ID = '22222222-2222-4222-8222-222222222222';
  const USER = 'owner-1';
  const GRANTED = '11111111-1111-4111-8111-111111111111';

  /** O WHERE que a instrução emitiu, sem o resto do SQL. */
  function whereOf(sql: string): string {
    const match = /WHERE\s+([\s\S]*?)(?:\s+RETURNING|\s*$)/.exec(sql);
    if (!match) throw new Error(`instrução gerada sem WHERE: ${sql}`);
    return match[1].trim();
  }

  /** Onde o predicado começa, deduzido dos placeholders que ele próprio usa. */
  function startIndexOf(where: string, params: unknown[]): number {
    return params.length - (where.match(/\$/g) ?? []).length + 1;
  }

  /** Toda instrução que o descritor gera endereçando UM registro pelo id. */
  function generated(descriptor: RegisteredTable): { label: string; sql: string; params: unknown[] }[] {
    const out = [
      { label: 'selectById', ...descriptor.selectById(ID, USER) },
      { label: 'deleteById', ...descriptor.deleteById(ID, USER) },
    ];
    const updatable = Object.entries(descriptor.columns).find(
      ([, column]) => column.mode === 'set-if-defined' || column.mode === 'clear-on-null',
    );
    if (updatable) {
      const update = descriptor.update(ID, USER, { [updatable[0]]: 'valor' });
      if (update) out.push({ label: 'update', ...update });
    }
    return out;
  }

  const SCOPES: [string, RequestScope][] = [
    ['sem escopo', {}],
    ['sob delegação', { restrictedToChildId: GRANTED }],
    ['com concessão do care team', { careTeamChildIds: [GRANTED] }],
  ];

  test.each(SCOPES)('o predicado é o de scopedById, e nenhum outro (%s)', (_label, scope) => {
    runWithScope(scope, () => {
      const offenders: string[] = [];
      for (const descriptor of registeredTables()) {
        for (const { label, sql, params } of generated(descriptor)) {
          const where = whereOf(sql);
          const esperado = scopedById(descriptor.table, ID, USER, startIndexOf(where, params)).where;
          if (where !== esperado) {
            offenders.push(`${descriptor.table}.${label}: "${where}" ≠ "${esperado}"`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  test('sob delegação, toda instrução de tabela child-scoped CARREGA a criança', () => {
    // A comparação acima é de forma; esta é do efeito. Se o predicado deixar
    // de ser o de `scopedById`, o id da criança some dos parâmetros e a
    // instrução volta a alcançar as outras crianças do mesmo dono — que foi
    // exatamente o vazamento das três vezes anteriores.
    runWithScope({ restrictedToChildId: GRANTED }, () => {
      const semCrianca: string[] = [];
      for (const descriptor of registeredTables()) {
        if (!CHILD_SCOPED_TABLES.has(descriptor.table)) continue;
        for (const { label, params } of generated(descriptor)) {
          if (!params.includes(GRANTED)) semCrianca.push(`${descriptor.table}.${label}`);
        }
      }
      expect(semCrianca).toEqual([]);
    });
  });

  test('com concessão, toda instrução de tabela child-scoped ganha a disjunção', () => {
    runWithScope({ careTeamChildIds: [GRANTED] }, () => {
      const semDisjuncao: string[] = [];
      for (const descriptor of registeredTables()) {
        if (!CHILD_SCOPED_TABLES.has(descriptor.table)) continue;
        for (const { label, sql } of generated(descriptor)) {
          if (!/child_id = ANY\(\$\d+::uuid\[\]\)/.test(sql)) {
            semDisjuncao.push(`${descriptor.table}.${label}`);
          }
        }
      }
      expect(semDisjuncao).toEqual([]);
    });
  });

  test('o registro cobre todo repositório que declara um descritor', () => {
    // Sem isto, um repositório que não carregasse sairia das varreduras acima
    // sem que nenhuma delas ficasse vermelha.
    const declaram = repositoryFiles().filter((file) =>
      readFileSync(join(REPO_DIR, file), 'utf8').includes('defineTable('),
    );
    expect(declaram.length).toBeGreaterThan(0);
    expect(registeredTables()).toHaveLength(declaram.length);
  });

  test('e as tabelas child-scoped estão MESMO entre elas', () => {
    // Uma varredura que só encontrasse tabelas da conta (sem `child_id`)
    // passaria os testes acima sem exercitar nada do que importa.
    const cobertas = registeredTables()
      .map((d) => d.table)
      .filter((t) => CHILD_SCOPED_TABLES.has(t));
    expect(cobertas.length).toBeGreaterThanOrEqual(10);
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
