import { MedicationService } from '../../../application/services/MedicationService';
import { createMedicationSchema, updateMedicationSchema, listMedicationFiltersSchema } from '../validations/medicalValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class MedicationController extends CrudController {
  constructor(service: MedicationService) {
    super(
      crudController({
        service,
        label: 'medication',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: { shape: 'entities', query: listMedicationFiltersSchema },
        create: { schema: createMedicationSchema, message: 'Medicamento criado com sucesso' },
        update: { schema: updateMedicationSchema, message: 'Medicamento atualizado com sucesso' },
      }),
    );
  }
}
