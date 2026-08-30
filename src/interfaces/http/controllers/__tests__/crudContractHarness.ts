/**
 * Arnês partilhado pelos testes de contrato dos controllers CRUD.
 *
 * Não é um teste: é o gravador. Executa um handler com `req`/`res` falsos e um
 * service stub, e devolve TUDO o que o handler fez de observável — chamadas ao
 * service (com os argumentos já convertidos), linhas de log, e o envelope
 * exato que saiu pelo `res`. É esse envelope que o frontend desempacota, por
 * isso ele é gravado inteiro em vez de amostrado.
 */

import { Request, Response } from 'express';
import logger from '../../../../infrastructure/utils/logger';
import { ComorbidityController } from '../ComorbidityController';
import { MedicationController } from '../MedicationController';
import { MedicalAppointmentController } from '../MedicalAppointmentController';
import { TherapistController } from '../TherapistController';
import { TherapySessionController } from '../TherapySessionController';
import { SchoolCommunicationController } from '../SchoolCommunicationController';
import { EducationPlanController } from '../EducationPlanController';
import { GoalController } from '../GoalController';
import { DevelopmentalMilestoneController } from '../DevelopmentalMilestoneController';
import { CommunicationLogController } from '../CommunicationLogController';
import { ReminderController } from '../ReminderController';
import { ComorbidityService } from '../../../../application/services/ComorbidityService';
import { MedicationService } from '../../../../application/services/MedicationService';
import { MedicalAppointmentService } from '../../../../application/services/MedicalAppointmentService';
import { TherapistService } from '../../../../application/services/TherapistService';
import { TherapySessionService } from '../../../../application/services/TherapySessionService';
import { SchoolCommunicationService } from '../../../../application/services/SchoolCommunicationService';
import { EducationPlanService } from '../../../../application/services/EducationPlanService';
import { GoalService } from '../../../../application/services/GoalService';
import { DevelopmentalMilestoneService } from '../../../../application/services/DevelopmentalMilestoneService';
import { CommunicationLogService } from '../../../../application/services/CommunicationLogService';
import { ReminderService } from '../../../../application/services/ReminderService';
import { UpcomingReminderService } from '../../../../application/services/UpcomingReminderService';

export type ServiceCall = { method: string; args: unknown[] };

export type HandlerRecord = {
  service: ServiceCall[];
  log: string[];
  status: number | null;
  json: unknown;
  sent: boolean;
  error?: string;
};

export type Handler = (req: Request, res: Response, next: (err?: unknown) => void) => void;

/** Marca valores que o JSON perderia: datas convertidas e chaves com `undefined`. */
export function normalize(value: unknown): unknown {
  if (value === undefined) return { __undefined: true };
  if (value === null) return null;
  if (value instanceof Date) return { __date: value.toISOString() };
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'function') return { __fn: (value as { name?: string }).name || 'anonymous' };
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** O `timestamp` do envelope é `new Date().toISOString()`: varia a cada corrida. */
function stripTimestamp(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'timestamp' in (payload as object)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(payload as Record<string, unknown>)) {
      out[key] = key === 'timestamp' ? '<iso>' : (payload as Record<string, unknown>)[key];
    }
    return out;
  }
  return payload;
}

export function makeServiceStub(
  results: Record<string, unknown>,
  calls: ServiceCall[],
): Record<string, unknown> {
  const stub: Record<string, unknown> = {};
  for (const [method, result] of Object.entries(results)) {
    stub[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve(result);
    };
  }
  return stub;
}

/** Entidade de domínio falsa: só o que os controllers tocam — `toJSON()`. */
export function entityFixture(json: Record<string, unknown>): { toJSON: () => unknown } {
  return { toJSON: () => json };
}

export async function runHandler(
  handler: Handler,
  req: Partial<Request>,
  calls: ServiceCall[],
): Promise<HandlerRecord> {
  const record: HandlerRecord = { service: calls, log: [], status: null, json: undefined, sent: false };

  const logSpy = jest.spyOn(logger, 'info').mockImplementation(((message: string) => {
    record.log.push(String(message));
    return logger;
  }) as never);

  const res = {
    status(code: number) {
      record.status = code;
      return res;
    },
    json(payload: unknown) {
      record.json = stripTimestamp(payload);
      return res;
    },
    send() {
      record.sent = true;
      return res;
    },
  };

  try {
    handler(req as Request, res as unknown as Response, (err?: unknown) => {
      record.error = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
    });
    // asyncHandler não devolve a promise; dois ticks bastam para os stubs.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    logSpy.mockRestore();
  }

  return record;
}

export function recordToJson(record: HandlerRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {
    service: normalize(record.service),
    log: record.log,
    status: record.status,
    json: normalize(record.json),
    sent: record.sent,
  };
  if (record.error !== undefined) out.error = record.error;
  return out;
}

/* ------------------------------------------------------------------ *
 * Controllers CRUD sob teste, e o pedido de exemplo de cada handler.
 * A mesma tabela alimenta dois testes: o do envelope de resposta
 * (crudControllerContract) e o de quem resolve o userId
 * (userIdResolverContract). Mexer aqui muda os dois — e o golden.
 * ------------------------------------------------------------------ */

export const OWNER = '018f4e8a-1111-7000-8000-000000000001';
export const CHILD = '018f4e8a-2222-7000-8000-000000000002';
export const ID = '018f4e8a-3333-7000-8000-000000000003';
const THERAPIST = '018f4e8a-4444-7000-8000-000000000004';
const T1 = '2024-03-01T10:00:00.000Z';
const T2 = '2024-03-02T11:30:00.000Z';

const ENTITY = entityFixture({ id: 'ent-1', kind: 'entity-json' });
const RAW = { id: 'raw-1', kind: 'raw-object' };
const PAGE = { data: [{ id: 'row-1' }], total: 42, page: 2, limit: 10 };

const ENTITY_CRUD = { list: [ENTITY], getById: ENTITY, create: ENTITY, update: ENTITY, remove: undefined };
const PAGED_CRUD = { list: PAGE, getById: ENTITY, create: ENTITY, update: ENTITY, remove: undefined };

export type Handlers = Record<string, Handler>;

export type CaseDef = {
  controller: string;
  build: (calls: ServiceCall[]) => Handlers;
  reqs: Record<string, Partial<Request>>;
};

const byId = { userId: OWNER, params: { id: ID } };

export const CRUD_CASES: CaseDef[] = [
  {
    controller: 'ComorbidityController',
    build: (calls) =>
      new ComorbidityController(
        makeServiceStub(ENTITY_CRUD, calls) as unknown as ComorbidityService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, conditionName: 'TDAH', icdCode: 'F90', diagnosisDate: '2024-01-05', notes: 'obs' },
      },
      update: { ...byId, body: { conditionName: 'TEA', diagnosingDoctor: null } },
      remove: byId,
    },
  },
  {
    controller: 'MedicationController',
    build: (calls) =>
      new MedicationController(
        makeServiceStub(ENTITY_CRUD, calls) as unknown as MedicationService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, active: 'true' } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, name: 'Ritalina', dosage: '10mg', frequency: '1x/dia', startDate: '2024-01-01', active: true },
      },
      update: { ...byId, body: { dosage: '20mg', endDate: null } },
      remove: byId,
    },
  },
  {
    controller: 'MedicalAppointmentController',
    build: (calls) =>
      new MedicalAppointmentController(
        makeServiceStub(PAGED_CRUD, calls) as unknown as MedicalAppointmentService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, from: T1, to: T2, page: '2', limit: '10' } },
      getById: byId,
      create: { userId: OWNER, body: { childId: CHILD, doctorName: 'Dra. Ana', occurredAt: T1, summary: 'consulta' } },
      update: { ...byId, body: { occurredAt: T2, followUpDate: '2024-04-01' } },
      remove: byId,
    },
  },
  {
    controller: 'TherapistController',
    build: (calls) =>
      new TherapistController(
        makeServiceStub({ list: [RAW], getById: RAW, create: RAW, update: RAW, remove: undefined }, calls) as unknown as TherapistService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: {} },
      getById: byId,
      create: { userId: OWNER, body: { name: 'Ana', specialty: 'ot', email: 'ana@example.com' } },
      update: { ...byId, body: { name: 'Ana Beatriz', phone: null } },
      remove: byId,
    },
  },
  {
    controller: 'TherapySessionController',
    build: (calls) =>
      new TherapySessionController(
        makeServiceStub({ list: PAGE, getById: RAW, create: RAW, update: RAW, remove: undefined }, calls) as unknown as TherapySessionService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, therapyType: 'aba', from: T1, to: T2, page: '2', limit: '10' } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, therapistId: THERAPIST, therapyType: 'aba', occurredAt: T1, durationMinutes: 60 },
      },
      update: { ...byId, body: { occurredAt: T2, durationMinutes: 45 } },
      remove: byId,
    },
  },
  {
    controller: 'SchoolCommunicationController',
    build: (calls) =>
      new SchoolCommunicationController(
        makeServiceStub(PAGED_CRUD, calls) as unknown as SchoolCommunicationService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, commType: 'bilhete', from: T1, to: T2, page: '1', limit: '20' } },
      getById: byId,
      create: { userId: OWNER, body: { childId: CHILD, occurredAt: T1, commType: 'reuniao', subject: 'Reunião' } },
      update: { ...byId, body: { subject: 'Reunião remarcada', occurredAt: T2 } },
      remove: byId,
    },
  },
  {
    controller: 'EducationPlanController',
    build: (calls) =>
      new EducationPlanController(
        makeServiceStub(ENTITY_CRUD, calls) as unknown as EducationPlanService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, academicYear: '2024' } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, schoolName: 'Escola Azul', academicYear: '2024', planType: 'pei', startDate: '2024-02-01' },
      },
      update: { ...byId, body: { schoolName: 'Escola Verde', endDate: null } },
      remove: byId,
    },
  },
  {
    controller: 'GoalController',
    build: (calls) =>
      new GoalController(makeServiceStub(ENTITY_CRUD, calls) as unknown as GoalService) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, domain: 'social', status: 'active' } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, domain: 'comunicacao', title: 'Pedir ajuda', targetDate: '2024-12-01', baselineValue: 2 },
      },
      update: { ...byId, body: { status: 'achieved', notes: null } },
      remove: byId,
    },
  },
  {
    controller: 'DevelopmentalMilestoneController',
    build: (calls) =>
      new DevelopmentalMilestoneController(
        makeServiceStub(ENTITY_CRUD, calls) as unknown as DevelopmentalMilestoneService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, category: 'language' } },
      getById: byId,
      create: {
        userId: OWNER,
        body: { childId: CHILD, title: 'Sentar sem apoio', category: 'motor_gross', status: 'achieved', achievedDate: '2024-01-01' },
      },
      update: { ...byId, body: { status: 'in_progress', targetDate: null } },
      remove: byId,
    },
  },
  {
    controller: 'CommunicationLogController',
    build: (calls) =>
      new CommunicationLogController(
        makeServiceStub(PAGED_CRUD, calls) as unknown as CommunicationLogService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, entryType: 'signs', from: T1, to: T2, page: '1', limit: '5' } },
      getById: byId,
      create: { userId: OWNER, body: { childId: CHILD, occurredAt: T1, entryType: 'vocabulary', wordsCount: 12 } },
      update: { ...byId, body: { occurredAt: T2, description: 'usou 3 sinais' } },
      remove: byId,
    },
  },
  {
    controller: 'ReminderController',
    build: (calls) =>
      new ReminderController(
        makeServiceStub(ENTITY_CRUD, calls) as unknown as ReminderService,
        makeServiceStub({ getUpcoming: [{ id: 'up-1' }, { id: 'up-2' }] }, calls) as unknown as UpcomingReminderService,
      ) as unknown as Handlers,
    reqs: {
      list: { userId: OWNER, query: { childId: CHILD, status: 'pending' } },
      getById: byId,
      create: { userId: OWNER, body: { childId: CHILD, title: 'Consulta', dueAt: T1, notes: 'levar exames' } },
      update: { ...byId, body: { title: 'Consulta remarcada', dueAt: T2, status: 'done' } },
      remove: byId,
      getUpcoming: { userId: OWNER, query: { childId: CHILD, days: '7' } },
    },
  },
];
