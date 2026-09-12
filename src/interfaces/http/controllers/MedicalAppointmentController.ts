import { MedicalAppointmentService } from '../../../application/services/MedicalAppointmentService';
import { createAppointmentSchema, updateAppointmentSchema, listAppointmentFiltersSchema } from '../validations/medicalValidation';
import { requireUserId } from './controllerUtils';
import { CrudController, crudController } from './crudController';

export class MedicalAppointmentController extends CrudController {
  constructor(service: MedicalAppointmentService) {
    super(
      crudController({
        service,
        label: 'medicalAppointment',
        resolveUserId: requireUserId,
        serialize: 'toJSON',
        list: {
          shape: 'paginated',
          query: listAppointmentFiltersSchema,
          toFilters: (parsed) => ({
            ...parsed,
            from: parsed.from ? new Date(parsed.from) : undefined,
            to: parsed.to ? new Date(parsed.to) : undefined,
          }),
        },
        create: {
          schema: createAppointmentSchema,
          message: 'Consulta criada com sucesso',
          toPayload: (parsed) => ({ ...parsed, occurredAt: new Date(parsed.occurredAt) }),
        },
        update: {
          schema: updateAppointmentSchema,
          message: 'Consulta atualizada com sucesso',
          toPayload: (parsed) => ({
            ...parsed,
            occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
          }),
        },
      }),
    );
  }
}
