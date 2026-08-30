import { TherapistService } from '../../../application/services/TherapistService';
import { createTherapistSchema, updateTherapistSchema } from '../validations/therapistValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class TherapistController extends CrudController {
  constructor(service: TherapistService) {
    super(
      crudController({
        service,
        label: 'therapist',
        resolveUserId: requireUserId,
        // O service de terapeuta devolve DTO, não entidade: nada de `toJSON()`.
        serialize: 'raw',
        list: { shape: 'raw' },
        create: { schema: createTherapistSchema, message: 'Terapeuta criado com sucesso' },
        update: { schema: updateTherapistSchema, message: 'Terapeuta atualizado com sucesso' },
      }),
    );
  }
}
