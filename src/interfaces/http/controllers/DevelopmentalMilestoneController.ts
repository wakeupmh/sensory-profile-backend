import { DevelopmentalMilestoneService } from '../../../application/services/DevelopmentalMilestoneService';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestoneFiltersSchema,
} from '../validations/developmentValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class DevelopmentalMilestoneController extends CrudController {
  constructor(service: DevelopmentalMilestoneService) {
    super(
      crudController({
        service,
        label: 'developmentalMilestone',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listMilestoneFiltersSchema },
        create: { schema: createMilestoneSchema, message: 'Marco criado com sucesso' },
        update: { schema: updateMilestoneSchema, message: 'Marco atualizado com sucesso' },
      }),
    );
  }
}
