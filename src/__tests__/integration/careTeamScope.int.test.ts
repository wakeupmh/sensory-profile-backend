/**
 * A espinha de autorização do care team, do predicado ao middleware.
 *
 * O teste que mais importa aqui é o mais chato: uma conta de responsável SEM
 * equipe tem de emitir exatamente o mesmo SQL de antes desta feature existir —
 * byte por byte, sem `OR` e sem parâmetro a mais. É a maioria esmagadora das
 * contas, e é a garantia de que a concessão não pode regredir quem não a usa.
 */
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { buildWhere, FilterSpec, scopedById } from 'infrastructure/repositories/queryUtils';
import { currentScope, runWithScope } from 'infrastructure/database/requestScope';
import {
  CareTeamGrantSource,
  createCareTeamScopeMiddleware,
} from 'interfaces/http/middleware/careTeamScopeMiddleware';

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const CHILD_A = '11111111-1111-4111-8111-111111111111';
const CHILD_B = '22222222-2222-4222-8222-222222222222';

/** Como as 9 listagens que usam `buildWhere` são: todas mapeiam `child_id`. */
const CHILD_SCOPED_MAP: Record<string, FilterSpec> = {
  childId: ['child_id'],
  status: ['status'],
};

/** Uma listagem de tabela da CONTA, que não tem criança nenhuma a restringir. */
const ACCOUNT_MAP: Record<string, FilterSpec> = {
  status: ['status'],
};

describe('sem equipe, o SQL emitido é o de sempre', () => {
  // A referência é o que sai FORA de qualquer escopo — ou seja, o predicado
  // que a aplicação emitia antes de o care team existir.
  const baselineList = buildWhere(OWNER, { childId: CHILD_A, status: 'open' }, CHILD_SCOPED_MAP);
  const baselineById = scopedById('daily_logs', 'log-1', OWNER);

  test('a referência é o predicado de hoje, escrito por extenso', () => {
    expect(baselineList.where).toBe('user_id = $1 AND child_id = $2 AND status = $3');
    expect(baselineList.params).toEqual([OWNER, CHILD_A, 'open']);
    expect(baselineList.nextIndex).toBe(4);
    expect(baselineById.where).toBe('id = $1 AND user_id = $2');
    expect(baselineById.params).toEqual(['log-1', OWNER]);
    expect(baselineById.nextIndex).toBe(3);
  });

  test.each([
    ['escopo vazio', {}],
    ['lista de concessões vazia', { careTeamChildIds: [] }],
    ['só autoria, sem concessão', { actingUserId: MEMBER }],
    ['autoria com lista vazia', { actingUserId: MEMBER, careTeamChildIds: [] }],
  ])('%s emite SQL idêntico, sem OR e sem parâmetro a mais', (_label, scope) => {
    runWithScope(scope, () => {
      const list = buildWhere(OWNER, { childId: CHILD_A, status: 'open' }, CHILD_SCOPED_MAP);
      const byId = scopedById('daily_logs', 'log-1', OWNER);

      expect(list.where).toBe(baselineList.where);
      expect(list.params).toEqual(baselineList.params);
      expect(list.nextIndex).toBe(baselineList.nextIndex);
      expect(byId.where).toBe(baselineById.where);
      expect(byId.params).toEqual(baselineById.params);
      expect(byId.nextIndex).toBe(baselineById.nextIndex);

      expect(list.where).not.toContain('OR');
      expect(byId.where).not.toContain('OR');
    });
  });

  test('nenhuma tabela child-scoped ganha predicado a mais com a lista vazia', () => {
    runWithScope({ careTeamChildIds: [], actingUserId: MEMBER }, () => {
      expect(scopedById('sensory_assessments', 'a-1', OWNER).where).toBe('id = $1 AND user_id = $2');
      expect(scopedById('documents', 'd-1', OWNER, 17).where).toBe('id = $17 AND user_id = $18');
    });
  });
});

describe('com concessão, o predicado do dono vira disjunção', () => {
  const grants = [CHILD_A, CHILD_B];

  test('scopedById alcança o registro pela criança concedida', () => {
    runWithScope({ actingUserId: MEMBER, careTeamChildIds: grants }, () => {
      const scope = scopedById('daily_logs', 'log-1', MEMBER);
      expect(scope.where).toBe('id = $1 AND (user_id = $2 OR child_id = ANY($3::uuid[]))');
      expect(scope.params).toEqual(['log-1', MEMBER, grants]);
      expect(scope.nextIndex).toBe(4);
    });
  });

  test('scopedById respeita o primeiro placeholder livre do UPDATE', () => {
    runWithScope({ careTeamChildIds: grants }, () => {
      const scope = scopedById('sensory_assessments', 'a-1', MEMBER, 17);
      expect(scope.where).toBe('id = $17 AND (user_id = $18 OR child_id = ANY($19::uuid[]))');
      expect(scope.params).toEqual(['a-1', MEMBER, grants]);
      expect(scope.nextIndex).toBe(20);
    });
  });

  test('buildWhere põe a lista num único parâmetro, antes dos filtros', () => {
    runWithScope({ careTeamChildIds: grants }, () => {
      const list = buildWhere(MEMBER, { childId: CHILD_A, status: 'open' }, CHILD_SCOPED_MAP);
      expect(list.where).toBe(
        '(user_id = $1 OR child_id = ANY($2::uuid[])) AND child_id = $3 AND status = $4',
      );
      expect(list.params).toEqual([MEMBER, grants, CHILD_A, 'open']);
      expect(list.nextIndex).toBe(5);
    });
  });

  test('buildWhere sem filtro nenhum devolve só a disjunção', () => {
    runWithScope({ careTeamChildIds: grants }, () => {
      const list = buildWhere(MEMBER, undefined, CHILD_SCOPED_MAP);
      expect(list.where).toBe('(user_id = $1 OR child_id = ANY($2::uuid[]))');
      expect(list.params).toEqual([MEMBER, grants]);
    });
  });

  test('o tamanho da equipe não muda o número de placeholders', () => {
    const muitas = Array.from({ length: 40 }, () => randomUUID());
    runWithScope({ careTeamChildIds: muitas }, () => {
      expect(scopedById('goals', 'g-1', MEMBER).where).toBe(
        'id = $1 AND (user_id = $2 OR child_id = ANY($3::uuid[]))',
      );
    });
  });

  test('tabela sem child_id fica intocada — a disjunção ali seria SQL inválido', () => {
    runWithScope({ careTeamChildIds: grants }, () => {
      // `therapists` e `anamneses` são da conta, não da criança.
      expect(scopedById('therapists', 't-1', MEMBER).where).toBe('id = $1 AND user_id = $2');
      expect(scopedById('anamneses', 'a-1', MEMBER).where).toBe('id = $1 AND user_id = $2');
      expect(scopedById('anamneses', 'a-1', MEMBER).params).toEqual(['a-1', MEMBER]);
    });
  });

  test('listagem cujo mapping não conhece child_id também fica intocada', () => {
    runWithScope({ careTeamChildIds: grants }, () => {
      const list = buildWhere(MEMBER, { status: 'open' }, ACCOUNT_MAP);
      expect(list.where).toBe('user_id = $1 AND status = $2');
      expect(list.params).toEqual([MEMBER, 'open']);
    });
  });
});

describe('delegação estreita, nunca alarga', () => {
  const grants = [CHILD_A, CHILD_B];
  const both = { restrictedToChildId: CHILD_A, actingUserId: MEMBER, careTeamChildIds: grants };

  test('sob delegação, scopedById emite exatamente o predicado delegado de hoje', () => {
    runWithScope(both, () => {
      const scope = scopedById('daily_logs', 'log-1', OWNER);
      expect(scope.where).toBe('id = $1 AND user_id = $2 AND child_id = $3');
      expect(scope.params).toEqual(['log-1', OWNER, CHILD_A]);
      expect(scope.where).not.toContain('OR');
    });
  });

  test('a criança delegada continua presa mesmo estando entre as concedidas', () => {
    // A concessão inclui CHILD_B; a delegação é para CHILD_A. O predicado não
    // pode dar nenhum caminho até CHILD_B.
    runWithScope(both, () => {
      expect(scopedById('documents', 'd-1', OWNER).params).toEqual(['d-1', OWNER, CHILD_A]);
      expect(JSON.stringify(scopedById('documents', 'd-1', OWNER))).not.toContain(CHILD_B);
    });
  });

  test('sob delegação, buildWhere emite o mesmo de hoje nos dois formatos de mapping', () => {
    const baselineChildScoped = runWithScope({ restrictedToChildId: CHILD_A }, () =>
      buildWhere(OWNER, { childId: CHILD_A }, CHILD_SCOPED_MAP),
    );
    const baselineAccount = runWithScope({ restrictedToChildId: CHILD_A }, () =>
      buildWhere(OWNER, undefined, ACCOUNT_MAP),
    );

    runWithScope(both, () => {
      const childScoped = buildWhere(OWNER, { childId: CHILD_A }, CHILD_SCOPED_MAP);
      expect(childScoped.where).toBe('user_id = $1 AND child_id = $2');
      expect(childScoped.where).toBe(baselineChildScoped.where);
      expect(childScoped.params).toEqual(baselineChildScoped.params);

      const account = buildWhere(OWNER, undefined, ACCOUNT_MAP);
      expect(account.where).toBe('user_id = $1 AND child_id = $2');
      expect(account.params).toEqual([OWNER, CHILD_A]);
      expect(account.where).toBe(baselineAccount.where);
    });
  });
});

describe('careTeamScopeMiddleware', () => {
  const schema = `care_team_scope_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  const revogada = randomUUID();
  const pendente = randomUUID();
  const outraPessoa = randomUUID();

  /**
   * A consulta das concessões corre contra Postgres de verdade, mas numa
   * `care_team_members` própria, num schema isolado à frente do `search_path`.
   * Duas razões: o teste vale antes e depois de a migration 035 correr, e não
   * escreve na tabela real enquanto outra pessoa ainda a está criando. As
   * colunas e a semântica (aceito e não revogado) são as do contrato; as FKs
   * ficam de fora porque não é o que está sob teste aqui.
   */
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(
      `CREATE TABLE care_team_members (
         id UUID PRIMARY KEY,
         child_id UUID NOT NULL,
         member_user_id TEXT NULL,
         member_name TEXT NOT NULL,
         role TEXT NOT NULL,
         granted_by_user_id TEXT NOT NULL,
         accepted_at TIMESTAMPTZ,
         revoked_at TIMESTAMPTZ,
         created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    );
    await client.query(
      `INSERT INTO care_team_members
         (id, child_id, member_user_id, member_name, role, granted_by_user_id, accepted_at, revoked_at)
       VALUES
         ($1, $2, $3, 'Fono', 'fonoaudiologia', $4, NOW(), NULL),
         ($5, $6, $3, 'Fono', 'fonoaudiologia', $4, NOW(), NOW()),
         ($7, $8, $3, 'Fono', 'fonoaudiologia', $4, NULL, NULL),
         ($9, $10, 'outro-membro', 'TO', 'terapia_ocupacional', $4, NOW(), NULL)`,
      [
        randomUUID(), CHILD_A, MEMBER, OWNER,
        randomUUID(), revogada,
        randomUUID(), pendente,
        randomUUID(), outraPessoa,
      ],
    );
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  });

  function fakeReq(overrides: Partial<Request> = {}): Request {
    return { userId: MEMBER, ...overrides } as Request;
  }
  const res = {} as Response;

  test('resolve só o que está aceito e não revogado, e uma única vez', async () => {
    let calls = 0;
    const counting: CareTeamGrantSource = {
      query: (text, values) => {
        calls += 1;
        return client.query(text, values as unknown[]);
      },
    };
    const middleware = createCareTeamScopeMiddleware(counting);

    let seen: string[] | undefined;
    await middleware(fakeReq(), res, (() => {
      seen = currentScope().careTeamChildIds;
    }) as NextFunction);

    expect(seen).toEqual([CHILD_A]);
    expect(seen).not.toContain(revogada);
    expect(seen).not.toContain(pendente);
    expect(seen).not.toContain(outraPessoa);
    // Uma vez por requisição — não uma por consulta.
    expect(calls).toBe(1);
  });

  test('a autoria é sempre de quem age, mesmo sem concessão nenhuma', async () => {
    const middleware = createCareTeamScopeMiddleware(client);
    let scope: ReturnType<typeof currentScope> | undefined;
    await middleware(fakeReq({ userId: 'responsavel-sem-equipe' }), res, (() => {
      scope = currentScope();
    }) as NextFunction);

    expect(scope?.actingUserId).toBe('responsavel-sem-equipe');
    // Sem equipe: o campo nem aparece, e o SQL não muda.
    expect(scope?.careTeamChildIds).toBeUndefined();
    runWithScope(scope ?? {}, () => {
      expect(scopedById('daily_logs', 'log-1', 'responsavel-sem-equipe').where).toBe(
        'id = $1 AND user_id = $2',
      );
    });
  });

  test('o escopo sobrevive à cadeia de await — que é o ponto todo', async () => {
    const middleware = createCareTeamScopeMiddleware(client);
    let where: string | undefined;
    await middleware(fakeReq(), res, (async () => {
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setTimeout(r, 1));
      await Promise.resolve();
      where = scopedById('documents', 'd-1', MEMBER).where;
    }) as unknown as NextFunction);

    // O `next` é async e o middleware não o espera (é assim que o Express
    // funciona), então dá-se uma volta ao event loop antes de conferir.
    await new Promise((r) => setTimeout(r, 10));
    expect(where).toBe('id = $1 AND (user_id = $2 OR child_id = ANY($3::uuid[]))');
  });

  test('sob delegação nem consulta o banco: a concessão não entraria de qualquer forma', async () => {
    let calls = 0;
    const counting: CareTeamGrantSource = {
      query: (text, values) => {
        calls += 1;
        return client.query(text, values as unknown[]);
      },
    };
    const middleware = createCareTeamScopeMiddleware(counting);

    let scope: ReturnType<typeof currentScope> | undefined;
    await runWithScope({ restrictedToChildId: CHILD_B }, () =>
      middleware(fakeReq({ delegatedChildId: CHILD_B }), res, (() => {
        scope = currentScope();
      }) as NextFunction),
    );

    expect(calls).toBe(0);
    expect(scope?.careTeamChildIds).toBeUndefined();
    // O escopo herdado da delegação continua de pé, e ganha a autoria.
    expect(scope?.restrictedToChildId).toBe(CHILD_B);
    expect(scope?.actingUserId).toBe(MEMBER);
  });

  test('sem userId não há concessão a resolver e o escopo não é tocado', async () => {
    let calls = 0;
    const counting: CareTeamGrantSource = {
      query: (text, values) => {
        calls += 1;
        return client.query(text, values as unknown[]);
      },
    };
    const middleware = createCareTeamScopeMiddleware(counting);

    let called = false;
    await middleware(fakeReq({ userId: undefined }), res, (() => {
      called = true;
      expect(currentScope()).toEqual({});
    }) as NextFunction);

    expect(called).toBe(true);
    expect(calls).toBe(0);
  });

  test('falha ao ler as concessões fecha o acesso sem derrubar a requisição', async () => {
    const broken: CareTeamGrantSource = {
      query: () => Promise.reject(Object.assign(new Error('relation does not exist'), { code: '42P01' })),
    };
    const middleware = createCareTeamScopeMiddleware(broken);

    let scope: ReturnType<typeof currentScope> | undefined;
    let error: unknown = 'não chamado';
    await middleware(fakeReq(), res, ((err?: unknown) => {
      error = err;
      scope = currentScope();
    }) as NextFunction);

    expect(error).toBeUndefined();
    expect(scope?.careTeamChildIds).toBeUndefined();
    expect(scope?.actingUserId).toBe(MEMBER);
  });
});
