import { GoalService } from '../../../application/services/GoalService';
import {
  createGoalSchema,
  updateGoalSchema,
  listGoalFiltersSchema,
} from '../validations/goalValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class GoalController extends CrudController {
  constructor(service: GoalService) {
    super(
      crudController({
        service,
        label: 'goal',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listGoalFiltersSchema },
        create: { schema: createGoalSchema, message: 'Meta criada com sucesso' },
        update: { schema: updateGoalSchema, message: 'Meta atualizada com sucesso' },
      }),
    );
  }
}
