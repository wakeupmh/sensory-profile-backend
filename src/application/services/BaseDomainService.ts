import { v7 as uuidv7 } from 'uuid';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';
import { currentScope } from '../../infrastructure/database/requestScope';
import pool from '../../infrastructure/database/connection';

/**
 * Minimal repository contract shared by all domain services.
 * Individual repository interfaces remain the source of truth for their
 * concrete types; this interface is intentionally loose (`any`) so the base
 * service can delegate without coupling to every entity/DTO shape.
 */
export interface BaseDomainRepository<TEntity, TCreateInput, TUpdateInput> {
  findAllByUser(userId: string, filters?: any): Promise<any>;
  findById(id: string, userId: string): Promise<TEntity | null>;
  save(input: TCreateInput): Promise<TEntity>;
  update(id: string, userId: string, data: TUpdateInput): Promise<TEntity | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

/**
 * Base CRUD service for domain entities that follow the standard
 * constructor(repo) + list/getById/create/update/remove pattern.
 *
 * @typeParam TEntity      The domain entity returned by the repository.
 * @typeParam TCreateInput The full input type passed to `repo.save` (includes id + userId).
 * @typeParam TUpdateInput The partial input type passed to `repo.update`.
 * @typeParam TPayload     The payload received from the controller (no id/userId yet).
 * @typeParam TUpdatePayload The payload received from the controller for updates.
 * @typeParam TFilters     The filters type accepted by `list`.
 */
export class BaseDomainService<
  TEntity,
  TCreateInput extends { id: string; userId: string },
  TUpdateInput,
  TPayload = Record<string, unknown>,
  TUpdatePayload = Partial<TPayload>,
  TFilters = any,
> {
  constructor(
    protected readonly repo: BaseDomainRepository<TEntity, TCreateInput, TUpdateInput>,
    protected readonly entityLabel: string,
  ) {}

  list(userId: string, filters?: TFilters): Promise<any> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<TEntity> {
    const entity = await this.repo.findById(id, userId);
    if (!entity) throw new NotFoundError(this.entityLabel, id);
    return entity;
  }

  /**
   * `childId` vem do corpo, e a FK só prova que a criança EXISTE — não que é
   * de quem escreve. Sem esta checagem, qualquer usuário autenticado grava
   * linhas penduradas na criança de outro (e as vê aparecer para a equipe /
   * compartilhamentos daquela criança). Vale o dono, ou uma concessão ativa do
   * care team resolvida para esta requisição. Responde 404, igual a "não
   * existe", para não confirmar que o id pertence a alguém.
   */
  protected async assertChildAccess(childId: string, userId: string): Promise<void> {
    if (currentScope().careTeamChildIds?.includes(childId)) return;
    const result = await pool.query(
      `SELECT 1 FROM children WHERE id = $1 AND user_id = $2`,
      [childId, userId],
    );
    if (result.rows.length === 0) throw new NotFoundError('Criança', childId);
  }

  async create(payload: TPayload, userId: string): Promise<TEntity> {
    const childId = (payload as { childId?: unknown } | null)?.childId;
    if (typeof childId === 'string') await this.assertChildAccess(childId, userId);
    // `actingUserId` é quem de fato está escrevendo (ver requestScope.ts);
    // `userId` é sempre o dono, que é quem a linha continua pertencendo a.
    // Só grava author_user_id quando os dois divergem — quando o próprio
    // dono escreve, fica NULL, do mesmo jeito que as linhas anteriores a
    // este recurso: assim "não-nulo" segue significando de forma confiável
    // "outra pessoa escreveu isto", em vez de virar `userId` repetido em
    // toda linha nova. `authorUserId` vem DEPOIS do `...payload` de
    // propósito — o payload é o corpo que o cliente mandou, e autoria não é
    // campo que quem chama a API possa forjar.
    const { actingUserId } = currentScope();
    const authorUserId = actingUserId && actingUserId !== userId ? actingUserId : undefined;
    const input = { id: uuidv7(), userId, ...payload, authorUserId } as unknown as TCreateInput;
    return this.repo.save(input);
  }

  async update(id: string, payload: TUpdatePayload, userId: string): Promise<TEntity> {
    const updated = await this.repo.update(id, userId, payload as unknown as TUpdateInput);
    if (!updated) throw new NotFoundError(this.entityLabel, id);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new NotFoundError(this.entityLabel, id);
  }
}
