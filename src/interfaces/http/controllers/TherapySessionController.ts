import { TherapySessionService } from '../../../application/services/TherapySessionService';
import { createSessionSchema, updateSessionSchema, listSessionFiltersSchema } from '../validations/therapySessionValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class TherapySessionController extends CrudController {
  constructor(service: TherapySessionService) {
    super(
      crudController({
        service,
        label: 'therapySession',
        resolveUserId: requireUserId,
        // O service de sessão devolve DTO, não entidade: nada de `toJSON()`.
        serialize: 'raw',
        list: {
          shape: 'paginated',
          query: listSessionFiltersSchema,
          toFilters: (parsed) => ({
            ...parsed,
            from: parsed.from ? new Date(parsed.from) : undefined,
            to: parsed.to ? new Date(parsed.to) : undefined,
          }),
        },
        create: {
          schema: createSessionSchema,
          message: 'Sessão criada com sucesso',
          toPayload: (parsed) => ({ ...parsed, occurredAt: new Date(parsed.occurredAt) }),
        },
        update: {
          schema: updateSessionSchema,
          message: 'Sessão atualizada com sucesso',
          toPayload: (parsed) => ({
            ...parsed,
            occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
          }),
        },
      }),
    );
  }
}
