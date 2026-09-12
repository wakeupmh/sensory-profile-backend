import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { jsonResponse } from '../utils/response';
import { assertValidId } from './controllerUtils';

/**
 * Fábrica dos cinco handlers CRUD (list/getById/create/update/remove) que
 * quinze controllers repetiam byte a byte, mudando só o nome do schema e a
 * etiqueta do log.
 *
 * O que a fábrica NÃO decide sozinha, porque é o que muda entre recursos e é
 * o que quebra em silêncio quando muda sem querer:
 *
 *  - `resolveUserId`: `requireUserId` resolve a delegação (sob
 *    `X-Delegate-Child-Id` devolve o dono); `requireOwnUserId` recusa a
 *    requisição delegada. Não há default aqui de propósito — cada controller
 *    diz qual dos dois usa, e o teste de delegação vigia que não troque.
 *  - o envelope: `serialize` e `list.shape` reproduzem exatamente o que cada
 *    controller já respondia — array de `toJSON()`, DTO cru, ou página com
 *    `{ total, page, limit }`. O frontend desempacota isso.
 *  - as mensagens em `create`/`update`, que vão como metadado do envelope.
 *  - `toPayload`/`toFilters`, para os recursos que convertem datas antes de
 *    chamar o service. Comportamento fora dessa forma continua escrito à mão
 *    no controller, ao lado dos handlers gerados.
 */

export type UserIdResolver = (req: Request) => string;

export type CrudHandler = (req: Request, res: Response, next: NextFunction) => void;

export interface CrudHandlers {
  list: CrudHandler;
  getById: CrudHandler;
  create: CrudHandler;
  update: CrudHandler;
  remove: CrudHandler;
}

/** Contrato mínimo que `BaseDomainService` já satisfaz. */
export interface CrudService<TEntity, TCreatePayload, TUpdatePayload, TFilters> {
  list(userId: string, filters?: TFilters): Promise<unknown>;
  getById(id: string, userId: string): Promise<TEntity>;
  create(payload: TCreatePayload, userId: string): Promise<TEntity>;
  update(id: string, payload: TUpdatePayload, userId: string): Promise<TEntity>;
  remove(id: string, userId: string): Promise<void>;
}

/** 'toJSON' quando o service devolve entidade de domínio; 'raw' quando já devolve DTO. */
export type SerializeMode = 'toJSON' | 'raw';

/**
 * - `entities`: array de entidades, serializado item a item, sem metadados.
 * - `raw`: o que o service devolveu, tal e qual.
 * - `paginated`: `{ data, total, page, limit }` → `data` no corpo e o resto
 *   como metadado do envelope.
 */
export type ListShape = 'entities' | 'raw' | 'paginated';

type Paginated = { data: unknown; total: number; page: number; limit: number };

export interface CrudControllerConfig<
  TEntity,
  TCreatePayload,
  TUpdatePayload,
  TFilters,
  TCreateSchema extends z.ZodTypeAny,
  TUpdateSchema extends z.ZodTypeAny,
  TListSchema extends z.ZodTypeAny,
> {
  service: CrudService<TEntity, TCreatePayload, TUpdatePayload, TFilters>;
  /** Prefixo das linhas de log: `[label.list]`, `[label.getById]`, … */
  label: string;
  resolveUserId: UserIdResolver;
  serialize: SerializeMode;
  list: {
    shape: ListShape;
    /** Ausente quando o `list` do recurso não aceita filtros (o service é chamado só com o userId). */
    query?: TListSchema;
    toFilters?: (parsed: z.infer<TListSchema>) => TFilters;
  };
  create: {
    schema: TCreateSchema;
    message: string;
    toPayload?: (parsed: z.infer<TCreateSchema>) => TCreatePayload;
  };
  update: {
    schema: TUpdateSchema;
    message: string;
    toPayload?: (parsed: z.infer<TUpdateSchema>) => TUpdatePayload;
  };
}

function serializeOne(entity: unknown, mode: SerializeMode): unknown {
  return mode === 'toJSON' ? (entity as { toJSON: () => unknown }).toJSON() : entity;
}

export function crudController<
  TEntity,
  TCreatePayload,
  TUpdatePayload,
  TFilters,
  TCreateSchema extends z.ZodTypeAny,
  TUpdateSchema extends z.ZodTypeAny,
  TListSchema extends z.ZodTypeAny,
>(
  config: CrudControllerConfig<
    TEntity,
    TCreatePayload,
    TUpdatePayload,
    TFilters,
    TCreateSchema,
    TUpdateSchema,
    TListSchema
  >,
): CrudHandlers {
  const { service, label, resolveUserId, serialize } = config;

  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const userId = resolveUserId(req);
      // Sem `query`, o service é chamado com um argumento só — passar
      // `undefined` explicitamente mudaria a aridade que os stubs observam.
      const filters = config.list.query
        ? ((config.list.toFilters
            ? config.list.toFilters(config.list.query.parse(req.query))
            : config.list.query.parse(req.query)) as TFilters)
        : undefined;
      logger.info(`[${label}.list] userId=${userId}`);
      const result = config.list.query ? await service.list(userId, filters) : await service.list(userId);

      if (config.list.shape === 'paginated') {
        const page = result as Paginated;
        jsonResponse(res, page.data, 200, { total: page.total, page: page.page, limit: page.limit });
        return;
      }
      if (config.list.shape === 'entities') {
        jsonResponse(res, (result as { toJSON: () => unknown }[]).map((item) => item.toJSON()));
        return;
      }
      jsonResponse(res, result);
    }),

    getById: asyncHandler(async (req: Request, res: Response) => {
      assertValidId(req.params.id);
      const userId = resolveUserId(req);
      logger.info(`[${label}.getById] userId=${userId} id=${req.params.id}`);
      const entity = await service.getById(req.params.id, userId);
      jsonResponse(res, serializeOne(entity, serialize));
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const userId = resolveUserId(req);
      const parsed = config.create.schema.parse(req.body);
      logger.info(`[${label}.create] userId=${userId}`);
      const payload = (config.create.toPayload ? config.create.toPayload(parsed) : parsed) as TCreatePayload;
      const entity = await service.create(payload, userId);
      jsonResponse(res, serializeOne(entity, serialize), 201, { message: config.create.message });
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      assertValidId(req.params.id);
      const userId = resolveUserId(req);
      const parsed = config.update.schema.parse(req.body);
      logger.info(`[${label}.update] userId=${userId} id=${req.params.id}`);
      const payload = (config.update.toPayload ? config.update.toPayload(parsed) : parsed) as TUpdatePayload;
      const entity = await service.update(req.params.id, payload, userId);
      jsonResponse(res, serializeOne(entity, serialize), 200, { message: config.update.message });
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      assertValidId(req.params.id);
      const userId = resolveUserId(req);
      logger.info(`[${label}.remove] userId=${userId} id=${req.params.id}`);
      await service.remove(req.params.id, userId);
      res.status(204).send();
    }),
  };
}

/**
 * Base dos controllers gerados. Existe só para que `new XController(service)` e
 * o `.bind()` das rotas continuem funcionando: os cinco handlers ficam sendo
 * campos da instância, como eram quando estavam escritos à mão. Endpoints extra
 * continuam a ser campos normais da subclasse.
 */
export class CrudController implements CrudHandlers {
  readonly list: CrudHandler;
  readonly getById: CrudHandler;
  readonly create: CrudHandler;
  readonly update: CrudHandler;
  readonly remove: CrudHandler;

  constructor(handlers: CrudHandlers) {
    this.list = handlers.list;
    this.getById = handlers.getById;
    this.create = handlers.create;
    this.update = handlers.update;
    this.remove = handlers.remove;
  }
}
