import { ComorbidityService } from '../../../application/services/ComorbidityService';
import { createComorbiditySchema, updateComorbiditySchema, listComorbidityFiltersSchema } from '../validations/medicalValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class ComorbidityController extends CrudController {
  constructor(service: ComorbidityService) {
    super(
      crudController({
        service,
        label: 'comorbidity',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listComorbidityFiltersSchema },
        create: { schema: createComorbiditySchema, message: 'Comorbidade criada com sucesso' },
        update: { schema: updateComorbiditySchema, message: 'Comorbidade atualizada com sucesso' },
      }),
    );
  }
}
