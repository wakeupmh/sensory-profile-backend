import { CommunicationLogService } from '../../../application/services/CommunicationLogService';
import {
  createCommunicationLogSchema,
  updateCommunicationLogSchema,
  listCommunicationLogFiltersSchema,
} from '../validations/developmentValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class CommunicationLogController extends CrudController {
  constructor(service: CommunicationLogService) {
    super(
      crudController({
        service,
        label: 'communicationLog',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        // Os filtros `from`/`to` seguem como string — quem converte é o
        // repositório. Só o `occurredAt` do corpo vira Date aqui.
        list: { shape: 'paginated', query: listCommunicationLogFiltersSchema },
        create: {
          schema: createCommunicationLogSchema,
          message: 'Registro de comunicação criado com sucesso',
          toPayload: (parsed) => ({ ...parsed, occurredAt: new Date(parsed.occurredAt) }),
        },
        update: {
          schema: updateCommunicationLogSchema,
          message: 'Registro de comunicação atualizado com sucesso',
          toPayload: (parsed) => ({
            ...parsed,
            occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
          }),
        },
      }),
    );
  }
}
