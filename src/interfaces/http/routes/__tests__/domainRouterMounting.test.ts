/**
 * Montagem de verdade, num Express de verdade.
 *
 * `careTeamScopeMounted.test.ts` lê o código-fonte e cobra a DECISÃO; este
 * arquivo levanta o app e cobra o EFEITO. Os dois são necessários porque a
 * montagem do Express é cheia de detalhe que não aparece na leitura:
 *
 *  - numa camada `router.use` o `req.params` está VAZIO (só a camada de *rota*
 *    o preenche) — foi por isso que a delegação passou a ler o id da criança de
 *    `req.baseUrl + req.path`, e é por isso que "parece montado" não basta;
 *  - `careTeamRoutes` é montado em `/api`, ANTES de `/api/children`, e é ele
 *    quem atende `/api/children/:childId/care-team`. Trocar a ordem dos dois
 *    `app.use` em `index.ts` muda quem responde, sem erro nenhum;
 *  - `consolidatedReportRoutes` tem UMA rota pública que precisa casar antes do
 *    `authMiddleware`;
 *  - e `medical`/`development`/`education`/`therapy` só pendura sub-routers: o
 *    encadeamento tem de alcançar `/api/medical/medications/:id` sem estar
 *    montado lá dentro.
 *
 * Os três middlewares do encadeamento entram dublados — o real exigiria JWT do
 * Supabase e Postgres. O que está sob teste não é o que eles fazem, é ONDE e em
 * QUE ORDEM eles correm, e isso os dublês registram fielmente. Os dublês imitam
 * a única parte que importa para a ordem: a delegação corre dentro de
 * `runWithScope` (que SUBSTITUI o store do AsyncLocalStorage) e a concessão
 * funde o escopo que já existe. Se a ordem inverter, o `actingUserId` some — e
 * é exatamente isso que se afirma aqui embaixo.
 */
import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { currentScope, runWithScope } from 'infrastructure/database/requestScope';

type ChainRequest = Request & { __chain?: string[] };

jest.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    const chained = req as Request & { __chain?: string[] };
    (chained.__chain = chained.__chain ?? []).push('auth');
    req.userId = 'user-sob-teste';
    next();
  },
}));

jest.mock('../../middleware/delegationMiddleware', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const scope = require('infrastructure/database/requestScope');
  return {
    createDelegationMiddleware: () => (req: Request, _res: Response, next: NextFunction) => {
      const chained = req as Request & { __chain?: string[] };
      (chained.__chain = chained.__chain ?? []).push('delegation');
      const childId = req.header('X-Delegate-Child-Id');
      if (!childId) return next();
      // Igual ao real: um escopo NOVO, que substitui o que houver.
      return scope.runWithScope({ restrictedToChildId: childId }, () => next());
    },
  };
});

jest.mock('../../middleware/careTeamScopeMiddleware', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const scope = require('infrastructure/database/requestScope');
  return {
    careTeamScopeMiddleware: (req: Request, _res: Response, next: NextFunction) => {
      const chained = req as Request & { __chain?: string[] };
      (chained.__chain = chained.__chain ?? []).push('careTeamScope');
      // Igual ao real: FUNDE o que já existe.
      return scope.runWithScope(
        { ...scope.currentScope(), actingUserId: req.userId },
        () => next(),
      );
    },
    createCareTeamScopeMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  };
});

import { domainRouter, delegationMiddleware } from '../domainRouter';
import { authMiddleware } from '../../middleware/authMiddleware';
import { careTeamScopeMiddleware } from '../../middleware/careTeamScopeMiddleware';
import assessmentRoutes from '../assessmentRoutes';
import careTeamRoutes from '../careTeamRoutes';
import clinicRoutes from '../clinicRoutes';
import childRoutes from '../childRoutes';
import accountRoutes from '../accountRoutes';
import dailyLogRoutes from '../dailyLogRoutes';
import voiceNoteRoutes from '../voiceNoteRoutes';
import therapyRoutes from '../therapyRoutes';
import medicalRoutes from '../medicalRoutes';
import developmentRoutes from '../developmentRoutes';
import educationRoutes from '../educationRoutes';
import consolidatedReportRoutes from '../consolidatedReportRoutes';
import searchRoutes from '../searchRoutes';

const CHILD_ID = '11111111-2222-4333-8444-555555555555';

/**
 * Dois segmentos, de propósito: um segmento só casaria as rotas `/:id` de meia
 * dúzia de routers e a sonda acabaria executando o controller de verdade — e o
 * Postgres junto. Nenhuma rota do app casa dois segmentos livres.
 */
const PROBE = '/__probe__/__probe__';

/**
 * O mesmo prefixo e a mesma ORDEM de `index.ts` — a paridade é conferida no
 * primeiro teste, para este app não descolar do que sobe em produção.
 */
const MOUNTS: Array<{ prefix: string; ident: string; router: Router; probes?: string[] }> = [
  { prefix: '/api/assessments', ident: 'assessmentRoutes', router: assessmentRoutes },
  {
    prefix: '/api',
    ident: 'careTeamRoutes',
    router: careTeamRoutes,
    // O router de `/api` não pode ter sonda coringa: ela engoliria tudo o que
    // vem montado depois. As duas sondas abaixo ficam sob os dois prefixos
    // dele, que é onde há encadeamento a observar.
    probes: [`/care-team${PROBE}`, `/children/:childId/care-team${PROBE}`],
  },
  { prefix: '/api/clinics', ident: 'clinicRoutes', router: clinicRoutes },
  { prefix: '/api/children', ident: 'childRoutes', router: childRoutes },
  { prefix: '/api/account', ident: 'accountRoutes', router: accountRoutes },
  { prefix: '/api/logs', ident: 'dailyLogRoutes', router: dailyLogRoutes },
  { prefix: '/api/voice-notes', ident: 'voiceNoteRoutes', router: voiceNoteRoutes },
  { prefix: '/api/therapy', ident: 'therapyRoutes', router: therapyRoutes },
  { prefix: '/api/medical', ident: 'medicalRoutes', router: medicalRoutes },
  { prefix: '/api/development', ident: 'developmentRoutes', router: developmentRoutes },
  { prefix: '/api/education', ident: 'educationRoutes', router: educationRoutes },
  { prefix: '/api/consolidated', ident: 'consolidatedReportRoutes', router: consolidatedReportRoutes },
  { prefix: '/api/search', ident: 'searchRoutes', router: searchRoutes },
];

/**
 * A sonda só corre quando o router real NÃO casou a requisição — e o
 * encadeamento, que é `use`, já correu de qualquer forma. É assim que se
 * observa o escopo que ele montou sem executar controller nenhum (que
 * precisaria de Postgres).
 */
function probeHandler(req: Request, res: Response): void {
  res.json({
    probe: true,
    chain: (req as ChainRequest).__chain ?? [],
    scope: currentScope(),
  });
}

const app = express();
for (const { prefix, router, probes } of MOUNTS) {
  const wrapper = Router();
  wrapper.use(router);
  for (const path of probes ?? ['*']) wrapper.all(path, probeHandler);
  app.use(prefix, wrapper);
}

/**
 * `OPTIONS` é a forma de perguntar ao Express "esta URL casa alguma rota?" sem
 * executar handler nenhum: o roteador responde sozinho com `Allow`, montado a
 * partir das rotas que casaram. Se casar, vem `Allow`; se não casar, a
 * requisição escorre até a sonda.
 */
async function optionsFor(path: string) {
  const res = await request(app).options(path);
  return {
    status: res.status,
    allow: (res.headers.allow ?? '').split(',').filter(Boolean).sort(),
    fellThrough: res.body?.probe === true,
  };
}

async function chainFor(path: string, headers: Record<string, string> = {}) {
  const res = await request(app).get(path).set(headers);
  expect(res.body.probe).toBe(true);
  return res.body as { chain: string[]; scope: Record<string, unknown> };
}

const CHAIN = ['auth', 'delegation', 'careTeamScope'];

describe('o encadeamento montado, num Express de verdade', () => {
  test('este app monta os mesmos prefixos, na mesma ordem, que index.ts', () => {
    const indexSource = readFileSync(join(__dirname, '..', '..', '..', '..', 'index.ts'), 'utf8');
    const reais = [...indexSource.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)].map((m) => `${m[1]} ${m[2]}`);
    const aqui = MOUNTS.map((m) => `${m.prefix} ${m.ident}`);

    // Subsequência: este app cobre parte dos routers, mas na ordem real.
    let cursor = 0;
    const forasteiros = aqui.filter((entry) => {
      const at = reais.indexOf(entry, cursor);
      if (at === -1) return true;
      cursor = at + 1;
      return false;
    });

    expect(forasteiros).toEqual([]);
  });

  test('a rota pública do relatório vem ANTES do encadeamento, no router de verdade', () => {
    // Sondar não serve aqui: `/shared/:token` casa de verdade e chamaria o
    // controller. A afirmação é sobre o objeto montado — a camada da rota
    // pública precede a camada que monta o `domainRouter()`, e é essa
    // precedência que faz o link compartilhado responder sem sessão nenhuma.
    const stack = (consolidatedReportRoutes as unknown as {
      stack: Array<{ route?: { path: string }; handle: { stack?: Array<{ handle: unknown }> } }>;
    }).stack;

    const publica = stack.findIndex((layer) => layer.route?.path === '/shared/:token');
    const encadeada = stack.findIndex((layer) => !layer.route && Array.isArray(layer.handle.stack));

    expect(publica).toBeGreaterThanOrEqual(0);
    expect(encadeada).toBeGreaterThan(publica);
    // E o que está montado ali é mesmo o encadeamento, não outra coisa.
    const montadas = stack[encadeada].handle.stack ?? [];
    expect(montadas.slice(0, 3).map((l) => l.handle)).toEqual([
      authMiddleware,
      delegationMiddleware,
      careTeamScopeMiddleware,
    ]);
  });

  test('domainRouter() devolve as três camadas, nesta ordem e nenhuma outra', () => {
    const handles = (domainRouter() as unknown as { stack: Array<{ handle: unknown }> }).stack.map(
      (layer) => layer.handle,
    );

    expect(handles).toEqual([authMiddleware, delegationMiddleware, careTeamScopeMiddleware]);
  });
});

describe('as rotas ainda resolvem', () => {
  test.each([
    ['/api/children', ['GET', 'HEAD', 'POST']],
    [`/api/children/${CHILD_ID}/shares`, ['GET', 'HEAD', 'POST']],
    [`/api/children/${CHILD_ID}/access-logs`, ['GET', 'HEAD']],
    [`/api/children/${CHILD_ID}/care-team`, ['GET', 'HEAD', 'POST']],
    ['/api/care-team/my-children', ['GET', 'HEAD']],
    [`/api/assessments/children/${CHILD_ID}`, ['GET', 'HEAD']],
    [`/api/medical/medications/${CHILD_ID}`, ['DELETE', 'GET', 'HEAD', 'PATCH']],
    ['/api/development/milestones', ['GET', 'HEAD', 'POST']],
    ['/api/development/logs', ['GET', 'HEAD', 'POST']],
    ['/api/education/plans', ['GET', 'HEAD', 'POST']],
    ['/api/therapy/sessions', ['GET', 'HEAD', 'POST']],
    [`/api/logs/${CHILD_ID}/attachments`, ['GET', 'HEAD', 'POST']],
    ['/api/consolidated/summary', ['GET', 'HEAD']],
    ['/api/consolidated/shared/algum-token', ['GET', 'HEAD']],
    ['/api/account/export', ['GET', 'HEAD']],
    ['/api/clinics/mine', ['GET', 'HEAD']],
    [`/api/voice-notes/${CHILD_ID}`, ['GET', 'HEAD']],
    ['/api/search', ['GET', 'HEAD']],
  ])('%s casa rota real', async (path, esperado) => {
    const { status, allow, fellThrough } = await optionsFor(path as string);

    expect(fellThrough).toBe(false);
    expect(status).toBe(200);
    expect(allow).toEqual(esperado);
  });

  test('e uma URL que não existe escorre até a sonda — a afirmação acima tem sentido', async () => {
    const { allow, fellThrough } = await optionsFor('/api/medical/medications/nada/aqui');

    expect(fellThrough).toBe(true);
    expect(allow).toEqual([]);
  });
});

describe('a ordem em que o encadeamento corre', () => {
  test.each([
    [`/api/children${PROBE}`],
    [`/api/logs${PROBE}`],
    [`/api/search${PROBE}`],
    [`/api/consolidated${PROBE}`],
    [`/api/assessments${PROBE}`],
    // Sub-routers: o encadeamento está montado no PAI, e tem de alcançar aqui.
    [`/api/medical/medications${PROBE}`],
    [`/api/development/milestones${PROBE}`],
    [`/api/education/plans${PROBE}`],
    [`/api/therapy/sessions${PROBE}`],
  ])('%s corre auth → delegação → concessão', async (path) => {
    const { chain } = await chainFor(path);

    expect(chain).toEqual(CHAIN);
  });

  test.each([
    [`/api/account${PROBE}`],
    [`/api/voice-notes${PROBE}`],
    [`/api/clinics${PROBE}`],
  ])('%s corre só a autenticação — a recusa é deliberada', async (path) => {
    const { chain } = await chainFor(path);

    expect(chain).toEqual(['auth']);
  });

  test('o ramo por prefixo da equipe de cuidado corre auth e delegação, sem concessão', async () => {
    const { chain } = await chainFor(`/api/children/${CHILD_ID}/care-team${PROBE}`);

    expect(chain).toEqual(['auth', 'delegation']);
  });

  test('o ramo do profissional corre só a autenticação', async () => {
    const { chain } = await chainFor(`/api/care-team${PROBE}`);

    expect(chain).toEqual(['auth']);
  });
});

describe('por que a ordem é essa', () => {
  test('sob delegação, a concessão FUNDE o escopo em vez de o descartar', async () => {
    const { chain, scope } = await chainFor(`/api/logs${PROBE}`, {
      'X-Delegate-Child-Id': CHILD_ID,
    });

    // As duas coisas ao mesmo tempo: a delegação estreitou para a criança E a
    // autoria sobreviveu. Com a concessão montada ANTES da delegação, o
    // `runWithScope` da delegação substituiria o store e `actingUserId`
    // sumiria — sem erro, sem log, só sem autoria. Esta é a afirmação
    // principal do arquivo, por isso vem antes da ordem em si.
    expect(scope).toEqual({ restrictedToChildId: CHILD_ID, actingUserId: 'user-sob-teste' });
    expect(chain).toEqual(CHAIN);
  });

  test('sem delegação, o escopo é só a autoria', async () => {
    const { scope } = await chainFor(`/api/logs${PROBE}`);

    expect(scope).toEqual({ actingUserId: 'user-sob-teste' });
  });

  test('fora de requisição alguma, o escopo é vazio — a sonda não mente', () => {
    expect(runWithScope({}, () => currentScope())).toEqual({});
  });
});
