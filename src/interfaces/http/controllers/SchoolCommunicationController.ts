import { SchoolCommunicationService } from '../../../application/services/SchoolCommunicationService';
import {
  createSchoolCommSchema,
  updateSchoolCommSchema,
  listSchoolCommFiltersSchema,
} from '../validations/educationValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class SchoolCommunicationController extends CrudController {
  constructor(service: SchoolCommunicationService) {
    super(
      crudController({
        service,
        label: 'schoolCommunication',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        // `occurredAt` chega como string e assim segue: é o próprio
        // SchoolCommunicationService que converte para Date.
        list: { shape: 'paginated', query: listSchoolCommFiltersSchema },
        create: { schema: createSchoolCommSchema, message: 'Comunicação escolar criada com sucesso' },
        update: { schema: updateSchoolCommSchema, message: 'Comunicação escolar atualizada com sucesso' },
      }),
    );
  }
}
