/**
 * A concessão da equipe de cuidado só existe se o middleware que a resolve
 * estiver MONTADO. Ele foi escrito, testado e ficou sem montagem nenhuma — o
 * predicado estava pronto em `queryUtils`, e a lista de crianças que o
 * alimenta nunca chegava lá. Nada quebrava: o profissional simplesmente não
 * enxergava nada, que é o modo de falha mais difícil de notar.
 *
 * A versão anterior deste arquivo lia os treze routers e cobrava as três
 * linhas do ritual em cada um, na ordem certa. As três linhas agora existem
 * uma vez só, dentro de `domainRouter()`, e a ordem deixou de ser uma coisa
 * que se pode escrever errado — não há mais treze lugares onde errar.
 *
 * Então o que este arquivo cobra mudou de assunto. Não é mais "a ordem está
 * certa?" (isso quem prova é `domainRouterMounting.test.ts`, montando um
 * Express de verdade), e sim "o ritual voltou a ser copiado?" e "quem ficou de
 * fora ficou por decisão escrita, ou por esquecimento?".
 *
 * A distinção importa porque o esquecimento não se parece com nada: um router
 * novo que monta só `authMiddleware` compila, passa, sobe e serve — só não
 * enxerga o que a equipe concedeu.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROUTES_DIR = join(__dirname, '..');

/** O único arquivo autorizado a nomear os middlewares do encadeamento. */
const HELPER = 'domainRouter.ts';

/**
 * Routers que montam o encadeamento À MÃO em vez de chamar `domainRouter()`.
 * O motivo fica aqui para não virar carimbo.
 */
const MONTA_A_MAO = new Map<string, string>([
  [
    'careTeamRoutes.ts',
    'dois prefixos irmãos sob /api pedem middlewares diferentes (`router.use` COM caminho), ' +
      'e nenhum dos dois quer a concessão: é a própria administração da equipe, roda sempre ' +
      'como o titular, e resolver concessão para decidir quem pode conceder seria circular',
  ],
]);

/**
 * Routers que veem dado de gente e deliberadamente NÃO recebem o
 * encadeamento. Ficar de fora é uma decisão, e uma decisão se escreve.
 */
const SEM_ENCADEAMENTO = new Map<string, string>([
  [
    'accountRoutes.ts',
    'exportação (LGPD Art. 18) e eliminação da conta. As consultas são escritas à mão com ' +
      '`user_id = $1`, não passam por `buildWhere`, e nem a delegação nem a concessão as ' +
      'alcançariam — mas montar o encadeamento aqui sugeriria que alcançam. Um profissional ' +
      'não exporta nem apaga o dossiê da família',
  ],
  [
    'voiceNoteRoutes.ts',
    'um ditado não pertence a criança nenhuma, então não há escopo a resolver — e resolver a ' +
      'delegação aqui só criaria a chance de gravar o ditado na conta errada. O ditado é ' +
      'sempre de quem falou',
  ],
  [
    'clinicRoutes.ts',
    'nenhuma rota daqui toca dado de criança: a clínica administra pessoas, não é caminho de ' +
      'acesso a dado. Montar a concessão aqui sugeriria que é — `clinicScopeIsolation.int.test.ts` ' +
      'cobra os dois lados dessa fronteira',
  ],
]);

/** Os nomes que, juntos, SÃO o encadeamento. */
const NOMES_DO_ENCADEAMENTO = [
  'delegationMiddleware',
  'createDelegationMiddleware',
  'careTeamScopeMiddleware',
  'createCareTeamScopeMiddleware',
];

/**
 * Casa o IMPORT, não a menção. `accountRoutes`, `voiceNoteRoutes` e
 * `clinicRoutes` citam os middlewares em comentário justamente para dizer que
 * não os usam; procurar o nome solto acusaria os três.
 */
const IMPORTA_DO_ENCADEAMENTO = new RegExp(
  String.raw`import\s*(?:type\s*)?\{[^}]*\b(?:${NOMES_DO_ENCADEAMENTO.join('|')})\b[^}]*\}`,
);

const IMPORTA_AUTH = /import\s*\{[^}]*\bauthMiddleware\b[^}]*\}/;
const USA_O_HELPER = /\bdomainRouter\s*\(/;

function routeFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));
}

function source(file: string): string {
  return readFileSync(join(ROUTES_DIR, file), 'utf8');
}

/**
 * Mesma armadilha do teste antigo, do outro lado: `careTeamRoutes` explica em
 * comentário POR QUE não chama `domainRouter()`, e procurar a chamada solta
 * acusaria justamente quem documentou a decisão. O que interessa é o código.
 */
function codigo(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('o encadeamento das rotas de domínio', () => {
  test('o helper existe e é ele quem nomeia os três middlewares', () => {
    expect(routeFiles()).toContain(HELPER);
    const helper = source(HELPER);
    for (const nome of ['authMiddleware', 'delegationMiddleware', 'careTeamScopeMiddleware']) {
      expect(helper).toContain(`router.use(${nome})`);
    }
  });

  test('ninguém monta o encadeamento à mão fora do helper', () => {
    const copiando = routeFiles().filter((file) => {
      if (file === HELPER || MONTA_A_MAO.has(file)) return false;
      return IMPORTA_DO_ENCADEAMENTO.test(source(file));
    });

    expect(copiando).toEqual([]);
  });

  test('quem chama o helper não monta autenticação por fora dele', () => {
    // Meia-conversão: chamar `domainRouter()` e ainda pendurar um
    // `router.use(authMiddleware)` faz a autenticação correr duas vezes e
    // sugere que o helper não a inclui.
    const duplicando = routeFiles().filter((file) => {
      if (file === HELPER || MONTA_A_MAO.has(file)) return false;
      const src = codigo(file);
      return USA_O_HELPER.test(src) && IMPORTA_AUTH.test(src);
    });

    expect(duplicando).toEqual([]);
  });

  test('quem fica de fora do encadeamento continua de fora, e por escrito', () => {
    // Se alguém converter um destes para `domainRouter()`, este teste cai —
    // que é o ponto: a decisão de trazer a exportação da conta, o ditado ou a
    // clínica para dentro do escopo tem de ser tomada aqui, não de raspão.
    const dentro = [...SEM_ENCADEAMENTO.keys()].filter((file) => USA_O_HELPER.test(codigo(file)));

    expect(dentro).toEqual([]);
  });

  test('nenhuma exceção declarada é obsoleta', () => {
    const existentes = new Set(routeFiles());
    const obsoletas = [...MONTA_A_MAO.keys(), ...SEM_ENCADEAMENTO.keys()].filter(
      (f) => !existentes.has(f),
    );

    expect(obsoletas).toEqual([]);
  });

  test('toda exceção traz motivo, não carimbo', () => {
    const semMotivo = [...MONTA_A_MAO, ...SEM_ENCADEAMENTO]
      .filter(([, motivo]) => motivo.trim().length < 40)
      .map(([file]) => file);

    expect(semMotivo).toEqual([]);
  });
});
