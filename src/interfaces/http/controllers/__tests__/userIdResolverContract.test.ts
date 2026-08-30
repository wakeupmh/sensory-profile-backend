/**
 * Quem resolve o userId, endpoint a endpoint.
 *
 * `requireUserId` resolve a delegação: sob `X-Delegate-Child-Id` devolve o id
 * do DONO da criança. `requireOwnUserId` recusa a requisição delegada. A
 * diferença é de segurança, não de estilo — com `requireUserId` numa rota que
 * CONCEDE acesso, um cuidador delegado poderia convidar alguém para a equipe de
 * uma criança que não é dele (ver o comentário no topo de CareTeamController).
 *
 * O teste não lê o import de ninguém: manda uma requisição DELEGADA e olha o
 * que acontece. Endpoint de `requireUserId` tem de resolver para o dono;
 * endpoint de `requireOwnUserId` tem de recusar com AuthorizationError sem
 * chegar ao service. Trocar um pelo outro — de propósito ou sem querer, numa
 * conversão futura para a fábrica — quebra aqui.
 */

import { Request } from 'express';

import { CareTeamController } from '../CareTeamController';
import { ClinicController } from '../ClinicController';
import { CareTeamService } from '../../../../application/services/CareTeamService';
import { ClinicService } from '../../../../application/services/ClinicService';
import {
  CHILD,
  CRUD_CASES,
  CaseDef,
  Handlers,
  ID,
  OWNER,
  ServiceCall,
  makeServiceStub,
  runHandler,
} from './crudContractHarness';

/** Quem chegou pela delegação: nunca deve aparecer no lugar do dono. */
const CAREGIVER = '018f4e8a-9999-7000-8000-000000000009';
const CLINIC = '018f4e8a-5555-7000-8000-000000000005';
const TOKEN = 'AbCdEfGhIjKlMnOpQrSt';

const DELEGATION_REFUSAL =
  'AuthorizationError: Account-level operations are not available through delegated access';

/** A mesma requisição do teste de contrato, só que chegando por delegação. */
function delegated(req: Partial<Request>): Partial<Request> {
  return { ...req, userId: CAREGIVER, effectiveUserId: OWNER, delegatedChildId: CHILD };
}

const CARE_TEAM_RESULTS = {
  invite: { toOwnerView: () => ({ id: ID }) },
  listForChild: [{ toListView: () => ({ id: ID }) }],
  revoke: undefined,
  acceptInvitation: { getId: () => ID, getChildId: () => CHILD, getRole: () => 'fonoaudiologia' },
  listMyChildren: [],
};

const CLINIC_RESULTS = {
  create: { toJSON: () => ({ id: CLINIC }) },
  listMine: [],
  invite: { toInviteView: () => ({ id: ID }) },
  listRoster: [{ member: { toRosterView: () => ({ id: ID }) }, caseloadSize: 3 }],
  revokeMember: undefined,
  acceptInvitation: { getId: () => ID, getClinicId: () => CLINIC, getRole: () => 'profissional' },
};

/** Controllers de nível de conta: `requireOwnUserId` em TODO endpoint. */
const OWN_USER_CASES: CaseDef[] = [
  {
    controller: 'CareTeamController',
    build: (calls) =>
      new CareTeamController(
        makeServiceStub(CARE_TEAM_RESULTS, calls) as unknown as CareTeamService,
      ) as unknown as Handlers,
    reqs: {
      invite: { params: { childId: CHILD }, body: { memberName: 'Ana', role: 'fonoaudiologia' } },
      list: { params: { childId: CHILD } },
      revoke: { params: { childId: CHILD, id: ID } },
      acceptInvitation: { body: { token: TOKEN } },
      myChildren: {},
    },
  },
  {
    controller: 'ClinicController',
    build: (calls) =>
      new ClinicController(makeServiceStub(CLINIC_RESULTS, calls) as unknown as ClinicService) as unknown as Handlers,
    reqs: {
      create: { body: { name: 'Clínica Azul' } },
      listMine: {},
      invite: { params: { clinicId: CLINIC }, body: { memberName: 'Bruno', role: 'profissional' } },
      roster: { params: { clinicId: CLINIC } },
      revokeMember: { params: { clinicId: CLINIC, id: ID } },
      acceptInvitation: { body: { token: TOKEN } },
    },
  },
];

function endpointsOf(cases: CaseDef[]): Array<[string, string, CaseDef, Partial<Request>]> {
  return cases.flatMap((testCase) =>
    Object.entries(testCase.reqs).map(
      ([op, req]) => [testCase.controller, op, testCase, req] as [string, string, CaseDef, Partial<Request>],
    ),
  );
}

describe('requireUserId endpoints resolve delegation to the owner', () => {
  test.each(endpointsOf(CRUD_CASES))('%s.%s', async (_controller, _op, testCase, req) => {
    const calls: ServiceCall[] = [];
    const record = await runHandler(testCase.build(calls)[_op], delegated(req), calls);

    expect(record.error).toBeUndefined();
    expect(record.service.length).toBeGreaterThan(0);
    for (const call of record.service) {
      expect(call.args).toContain(OWNER);
      expect(call.args).not.toContain(CAREGIVER);
    }
    for (const line of record.log) {
      expect(line).toContain(`userId=${OWNER}`);
      expect(line).not.toContain(CAREGIVER);
    }
  });
});

describe('requireOwnUserId endpoints refuse delegated requests', () => {
  test.each(endpointsOf(OWN_USER_CASES))('%s.%s', async (_controller, _op, testCase, req) => {
    const calls: ServiceCall[] = [];
    const record = await runHandler(testCase.build(calls)[_op], delegated(req), calls);

    expect(record.error).toBe(DELEGATION_REFUSAL);
    // Recusa antes de tocar no service: nada foi lido nem escrito.
    expect(record.service).toHaveLength(0);
    expect(record.status).toBeNull();
  });

  // Controle: sem delegação os mesmos endpoints funcionam. Sem isto, um
  // endpoint quebrado por outro motivo passaria por "recusa correta".
  test.each(endpointsOf(OWN_USER_CASES))('%s.%s serves the account owner', async (_c, _op, testCase, req) => {
    const calls: ServiceCall[] = [];
    const record = await runHandler(testCase.build(calls)[_op], { ...req, userId: OWNER }, calls);

    expect(record.error).toBeUndefined();
    expect(record.service.length).toBeGreaterThan(0);
    for (const call of record.service) {
      expect(call.args).toContain(OWNER);
    }
  });
});
