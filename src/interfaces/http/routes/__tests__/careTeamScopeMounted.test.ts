/**
 * A concessão da equipe de cuidado só existe se o middleware que a resolve
 * estiver MONTADO. Ele foi escrito, testado e ficou sem montagem nenhuma — o
 * predicado estava pronto em `queryUtils`, e a lista de crianças que o
 * alimenta nunca chegava lá. Nada quebrava: o profissional simplesmente não
 * enxergava nada, que é o modo de falha mais difícil de notar.
 *
 * Este teste lê os arquivos de rota e cobra a decisão, do mesmo jeito que a
 * cobertura da eliminação cobra por tabela: quem monta `delegationMiddleware`
 * monta este também, ou aparece aqui embaixo com o motivo escrito.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROUTES_DIR = join(__dirname, '..');

/**
 * Routers que veem `delegationMiddleware` e deliberadamente NÃO recebem a
 * concessão. O motivo fica aqui para não virar carimbo.
 */
const INTENTIONALLY_WITHOUT_GRANT = new Map<string, string>([
  [
    'careTeamRoutes.ts',
    // Todo endpoint dele usa `requireOwnUserId` e trata da concessão em si:
    // resolver concessão para decidir quem pode conceder seria circular.
    'é a própria administração da equipe; roda sempre como o titular',
  ],
]);

function routeFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));
}

/**
 * Casa a MONTAGEM, não a menção. `accountRoutes` e `voiceNoteRoutes` citam
 * `delegationMiddleware` num comentário justamente para dizer que não o usam;
 * procurar o nome solto acusaria os dois.
 *
 * As duas formas de montar contam: `router.use(delegationMiddleware)` e a com
 * caminho, `router.use('/children/:childId/care-team', auth, delegation)`.
 */
const MONTA_DELEGACAO = /router\.use\([^)]*\bdelegationMiddleware\b/;

describe('montagem do careTeamScopeMiddleware', () => {
  test('todo router com delegação resolve também a concessão', () => {
    const faltando = routeFiles().filter((file) => {
      if (INTENTIONALLY_WITHOUT_GRANT.has(file)) return false;
      const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      return MONTA_DELEGACAO.test(source) && !source.includes('careTeamScopeMiddleware');
    });

    expect(faltando).toEqual([]);
  });

  test('a concessão é resolvida DEPOIS da delegação, nunca antes', () => {
    // `runWithScope` SUBSTITUI o store do AsyncLocalStorage em vez de o
    // fundir: montado antes da delegação, o escopo daqui seria descartado
    // inteiro — inclusive o `actingUserId`, que é a autoria.
    const foraDeOrdem = routeFiles().filter((file) => {
      const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      const delegacao = source.indexOf('router.use(delegationMiddleware)');
      const concessao = source.indexOf('router.use(careTeamScopeMiddleware)');
      return delegacao !== -1 && concessao !== -1 && concessao < delegacao;
    });

    expect(foraDeOrdem).toEqual([]);
  });

  test('a exportação e a eliminação da conta ficam fora da concessão', () => {
    // `accountRoutes` é export (LGPD Art. 18) e eliminação. Suas consultas são
    // escritas à mão com `user_id = $1` e não passam por `buildWhere`, então a
    // concessão não as alcança de qualquer forma — mas montar o middleware ali
    // sugeriria que alcança. Um profissional não exporta o dossiê da família.
    const source = readFileSync(join(ROUTES_DIR, 'accountRoutes.ts'), 'utf8');
    expect(source).not.toContain('careTeamScopeMiddleware');
  });

  test('as exceções listadas ainda existem', () => {
    const existentes = new Set(routeFiles());
    const obsoletas = [...INTENTIONALLY_WITHOUT_GRANT.keys()].filter((f) => !existentes.has(f));
    expect(obsoletas).toEqual([]);
  });
});
