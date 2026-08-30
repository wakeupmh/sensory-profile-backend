/**
 * Equipe de cuidado — serviço e controlador, contra repositório e Pool falsos
 * (sem banco).
 *
 * O que estes casos guardam:
 *  1. só o dono da criança convida — e a delegação NÃO vale como dono
 *  2. o token só existe na resposta da criação; a listagem não o devolve
 *  3. autoaceite é recusado, e toda falha de aceite tem a mesma mensagem
 *  4. revogação é escopada por criança + dono e é soft (o serviço não apaga)
 */

import { Request, RequestHandler, Response } from 'express';

import { CareTeamService } from 'application/services/CareTeamService';
import { CareTeamController } from 'interfaces/http/controllers/CareTeamController';
import { CareTeamMember, CareTeamMemberProps } from 'domain/entities/CareTeamMember';
import type { CareTeamMemberRepository } from 'domain/repositories/CareTeamMemberRepository';
import {
  NotFoundError,
  InvitationInvalidError,
  AuthorizationError,
} from 'infrastructure/utils/errors/CustomErrors';

const OWNER_ID = 'owner-001';
const PROFESSIONAL_ID = 'prof-777';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const OTHER_CHILD_ID = '018f4e8a-0000-7000-8000-bbbbbbbbbbbb';
const MEMBER_ROW_ID = '018f4e8a-0000-7000-8000-000000000001';
const NOW = new Date('2026-06-15T10:30:00.000Z');

function makeMember(overrides: Partial<CareTeamMemberProps> = {}): CareTeamMember {
  return new CareTeamMember({
    id: MEMBER_ROW_ID,
    childId: CHILD_ID,
    memberUserId: null,
    memberName: 'Dra. Marina',
    role: 'fonoaudiologia',
    grantedByUserId: OWNER_ID,
    invitationToken: 'tok_abc123',
    invitationExpiresAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeRepo(overrides: Partial<CareTeamMemberRepository> = {}): CareTeamMemberRepository {
  return {
    save: jest.fn().mockResolvedValue(makeMember()),
    findByInvitationToken: jest.fn().mockResolvedValue(null),
    acceptInvitation: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(true),
    listForChild: jest.fn().mockResolvedValue([]),
    listCaseload: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// Pool mínimo: o serviço só consulta "esta criança é deste usuário?".
function makePool(ownedByUserIds: string[] = [OWNER_ID]) {
  return {
    query: jest.fn().mockImplementation((_sql: string, params: unknown[]) => {
      const userId = params[1] as string;
      return Promise.resolve({ rows: ownedByUserIds.includes(userId) ? [{ 1: 1 }] : [] });
    }),
  } as unknown as import('pg').Pool;
}

function makeService(opts: {
  repo?: Partial<CareTeamMemberRepository>;
  ownedByUserIds?: string[];
} = {}): CareTeamService {
  return new CareTeamService(makeRepo(opts.repo), makePool(opts.ownedByUserIds ?? [OWNER_ID]));
}

/** Requisição autenticada; `effectiveUserId` só aparece sob delegação. */
function makeReq(overrides: Partial<Request> = {}): Request {
  return { params: {}, body: {}, query: {}, headers: {}, ...overrides } as unknown as Request;
}

interface Invoked {
  status: number;
  body: Record<string, unknown> | undefined;
  error?: Error;
}

/** Executa um handler de controlador e captura a resposta OU o erro. */
function invoke(handler: RequestHandler, req: Request): Promise<Invoked> {
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      json(body: Record<string, unknown>) {
        resolve({ status, body });
        return res;
      },
    } as unknown as Response;
    handler(req, res, ((error?: unknown) =>
      resolve({ status: 0, body: undefined, error: error as Error })) as never);
  });
}

describe('CareTeamService — convite', () => {
  test('invite throws NotFoundError when the child does not belong to the caller', async () => {
    const service = makeService({ ownedByUserIds: [] });
    await expect(
      service.invite(CHILD_ID, { memberName: 'Dra. Marina', role: 'fonoaudiologia' }, OWNER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  test('invite saves a fresh token with a ~14-day expiry and the chosen role', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    await service.invite(CHILD_ID, { memberName: 'Dra. Marina', role: 'psicologia' }, OWNER_ID);

    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.childId).toBe(CHILD_ID);
    // O concedente é sempre o dono — nunca "quem clicou".
    expect(saveArg.grantedByUserId).toBe(OWNER_ID);
    expect(saveArg.role).toBe('psicologia');
    expect(typeof saveArg.invitationToken).toBe('string');
    expect(saveArg.invitationToken.length).toBeGreaterThan(10);

    const expiresInDays = (saveArg.invitationExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(expiresInDays).toBeGreaterThan(13.9);
    expect(expiresInDays).toBeLessThan(14.1);
  });

  test('two invitations never share a token', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    await service.invite(CHILD_ID, { memberName: 'A', role: 'outro' }, OWNER_ID);
    await service.invite(CHILD_ID, { memberName: 'B', role: 'outro' }, OWNER_ID);
    const [first, second] = (repo.save as jest.Mock).mock.calls.map((c) => c[0].invitationToken);
    expect(first).not.toBe(second);
  });

  test('listForChild refuses a caller who does not own the child', async () => {
    const repo = makeRepo();
    const service = makeService({ repo, ownedByUserIds: [] });
    await expect(service.listForChild(CHILD_ID, 'estranho')).rejects.toThrow(NotFoundError);
    expect(repo.listForChild).not.toHaveBeenCalled();
  });
});

describe('CareTeamService — aceite', () => {
  test('an unknown token is refused', async () => {
    const service = makeService({ repo: { findByInvitationToken: jest.fn().mockResolvedValue(null) } });
    await expect(service.acceptInvitation('token-inexistente', PROFESSIONAL_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('an expired token is refused (the repository never hands it over)', async () => {
    // A validade é checada no SQL: um convite vencido simplesmente não é
    // encontrado, então o serviço vê o mesmo que veria com um token inventado.
    const repo = makeRepo({ findByInvitationToken: jest.fn().mockResolvedValue(null) });
    const service = makeService({ repo });
    await expect(service.acceptInvitation('tok_abc123', PROFESSIONAL_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
    expect(repo.acceptInvitation).not.toHaveBeenCalled();
  });

  test('self-accept by the granter is refused', async () => {
    const repo = makeRepo({ findByInvitationToken: jest.fn().mockResolvedValue(makeMember()) });
    const service = makeService({ repo });
    await expect(service.acceptInvitation('tok_abc123', OWNER_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
    expect(repo.acceptInvitation).not.toHaveBeenCalled();
  });

  test('a lost race (conditional UPDATE touched no row) is refused', async () => {
    const repo = makeRepo({
      findByInvitationToken: jest.fn().mockResolvedValue(makeMember()),
      acceptInvitation: jest.fn().mockResolvedValue(null),
    });
    const service = makeService({ repo });
    await expect(service.acceptInvitation('tok_abc123', PROFESSIONAL_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('every accept failure carries the exact same message', async () => {
    const unknown = makeService({ repo: { findByInvitationToken: jest.fn().mockResolvedValue(null) } });
    const selfAccept = makeService({
      repo: { findByInvitationToken: jest.fn().mockResolvedValue(makeMember()) },
    });
    const lostRace = makeService({
      repo: {
        findByInvitationToken: jest.fn().mockResolvedValue(makeMember()),
        acceptInvitation: jest.fn().mockResolvedValue(null),
      },
    });

    const messages = await Promise.all(
      [
        unknown.acceptInvitation('tok_x', PROFESSIONAL_ID),
        selfAccept.acceptInvitation('tok_abc123', OWNER_ID),
        lostRace.acceptInvitation('tok_abc123', PROFESSIONAL_ID),
      ].map((p) => p.then(() => 'sucesso inesperado', (e: Error) => e.message)),
    );
    expect(new Set(messages).size).toBe(1);
  });

  test('a successful accept returns the membership bound to the accepting sub', async () => {
    const accepted = makeMember({
      memberUserId: PROFESSIONAL_ID,
      acceptedAt: NOW,
      invitationToken: null,
      invitationExpiresAt: null,
    });
    const service = makeService({
      repo: {
        findByInvitationToken: jest.fn().mockResolvedValue(makeMember()),
        acceptInvitation: jest.fn().mockResolvedValue(accepted),
      },
    });
    const result = await service.acceptInvitation('tok_abc123', PROFESSIONAL_ID);
    expect(result.getMemberUserId()).toBe(PROFESSIONAL_ID);
    expect(result.getStatus()).toBe('accepted');
  });
});

describe('CareTeamService — revogação', () => {
  test('revoke scopes the update by child AND granter, and never deletes', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    await service.revoke(MEMBER_ROW_ID, CHILD_ID, OWNER_ID);
    expect(repo.revoke).toHaveBeenCalledWith(MEMBER_ROW_ID, CHILD_ID, OWNER_ID);
    // Não existe caminho de exclusão no repositório — a trilha é o produto.
    expect(Object.keys(repo)).not.toContain('delete');
  });

  test('revoke throws NotFoundError when no row matched (not the owner, or already revoked)', async () => {
    const service = makeService({ repo: { revoke: jest.fn().mockResolvedValue(false) } });
    await expect(service.revoke(MEMBER_ROW_ID, CHILD_ID, 'estranho')).rejects.toThrow(NotFoundError);
  });
});

describe('CareTeamController — autorização', () => {
  const service = makeService();
  const controller = new CareTeamController(service);

  const delegated = () =>
    makeReq({
      userId: 'cuidador-delegado',
      effectiveUserId: OWNER_ID,
      delegatedChildId: CHILD_ID,
      params: { childId: CHILD_ID, id: MEMBER_ROW_ID },
      body: { memberName: 'Dra. Marina', role: 'fonoaudiologia' },
    });

  test('a delegated request cannot invite', async () => {
    const spy = jest.spyOn(service, 'invite');
    const { error } = await invoke(controller.invite, delegated());
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('a delegated request cannot revoke', async () => {
    const spy = jest.spyOn(service, 'revoke');
    const { error } = await invoke(controller.revoke, delegated());
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('a delegated request cannot list the team', async () => {
    const { error } = await invoke(controller.list, delegated());
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  test("a delegated request cannot read the owner's caseload as its own", async () => {
    const { error } = await invoke(controller.myChildren, delegated());
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  test('a delegated request cannot accept an invitation on the owner behalf', async () => {
    const req = delegated();
    req.body = { token: 'a'.repeat(24) };
    const { error } = await invoke(controller.acceptInvitation, req);
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  test('an unauthenticated request is refused before anything else', async () => {
    const { error } = await invoke(controller.list, makeReq({ params: { childId: CHILD_ID } }));
    expect(error).toBeDefined();
  });

  test('the child id in the path must be a uuid', async () => {
    const req = makeReq({ userId: OWNER_ID, params: { childId: 'nao-e-uuid' } });
    const { error } = await invoke(controller.list, req);
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/child ID/);
  });
});

describe('CareTeamController — o token só sai uma vez', () => {
  test('the creation response carries the token', async () => {
    const created = makeMember();
    const service = makeService({ repo: { save: jest.fn().mockResolvedValue(created) } });
    const controller = new CareTeamController(service);
    const req = makeReq({
      userId: OWNER_ID,
      params: { childId: CHILD_ID },
      body: { memberName: 'Dra. Marina', role: 'fonoaudiologia' },
    });

    const { status, body } = await invoke(controller.invite, req);
    expect(status).toBe(201);
    expect((body?.data as Record<string, unknown>).invitationToken).toBe('tok_abc123');
  });

  test('the listing NEVER carries a pending invitation token', async () => {
    // A falha que isto guarda: com o token na listagem, qualquer um que
    // enxergasse a tela aceitaria o convite endereçado a outra pessoa.
    const pending = makeMember();
    const acceptedOne = makeMember({
      id: '018f4e8a-0000-7000-8000-000000000002',
      memberUserId: PROFESSIONAL_ID,
      acceptedAt: NOW,
      invitationToken: null,
    });
    const service = makeService({
      repo: { listForChild: jest.fn().mockResolvedValue([pending, acceptedOne]) },
    });
    const controller = new CareTeamController(service);
    const req = makeReq({ userId: OWNER_ID, params: { childId: CHILD_ID } });

    const { status, body } = await invoke(controller.list, req);
    expect(status).toBe(200);
    const rows = body?.data as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).not.toHaveProperty('invitationToken');
    }
    // E o token não vaza por nenhum outro canal da mesma resposta.
    expect(JSON.stringify(body)).not.toContain('tok_abc123');
    expect(rows[0].status).toBe('pending');
    expect(rows[1].status).toBe('accepted');
  });

  test('a revoked membership still shows up for the owner, marked as revoked', async () => {
    const revoked = makeMember({ memberUserId: PROFESSIONAL_ID, acceptedAt: NOW, revokedAt: NOW, invitationToken: null });
    const service = makeService({ repo: { listForChild: jest.fn().mockResolvedValue([revoked]) } });
    const controller = new CareTeamController(service);
    const req = makeReq({ userId: OWNER_ID, params: { childId: OTHER_CHILD_ID } });

    const { body } = await invoke(controller.list, req);
    const rows = body?.data as Record<string, unknown>[];
    expect(rows[0].status).toBe('revoked');
    expect(rows[0].revokedAt).toEqual(NOW);
  });
});

describe('careTeamValidation', () => {
  test('an unknown role is rejected before it reaches the database CHECK', async () => {
    const service = makeService();
    const controller = new CareTeamController(service);
    const req = makeReq({
      userId: OWNER_ID,
      params: { childId: CHILD_ID },
      body: { memberName: 'Dra. Marina', role: 'nutricao' },
    });
    const { error } = await invoke(controller.invite, req);
    expect(error).toBeDefined();
  });

  test('an empty member name is rejected', async () => {
    const service = makeService();
    const controller = new CareTeamController(service);
    const req = makeReq({
      userId: OWNER_ID,
      params: { childId: CHILD_ID },
      body: { memberName: '   ', role: 'outro' },
    });
    const { error } = await invoke(controller.invite, req);
    expect(error).toBeDefined();
  });
});
