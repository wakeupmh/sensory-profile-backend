import { EducationPlanService } from '../../../application/services/EducationPlanService';
import {
  createEducationPlanSchema,
  updateEducationPlanSchema,
  listEducationPlanFiltersSchema,
} from '../validations/educationValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class EducationPlanController extends CrudController {
  constructor(service: EducationPlanService) {
    super(
      crudController({
        service,
        label: 'educationPlan',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listEducationPlanFiltersSchema },
        create: { schema: createEducationPlanSchema, message: 'Plano educacional criado com sucesso' },
        update: { schema: updateEducationPlanSchema, message: 'Plano educacional atualizado com sucesso' },
      }),
    );
  }
}
