import { createAnamneseSchema } from '../anamneseValidation';

// O formulário guarda gravidez planejada, frequenta escola e professor de apoio
// como sim/não (boolean); recusar isso impedia salvar qualquer anamnese.
const payload = (sections: Record<string, Record<string, unknown>>) => ({
  child: { name: 'Léo Souza', birthDate: '2022-02-03', gender: 'male' },
  caregiver: { name: 'Maria Souza', relationship: 'mother' },
  clinicalHistory: { queixa: {}, gestation: {}, development: {}, health: {}, school: {}, family: {}, ...sections },
});

describe('sim/não da anamnese', () => {
  test.each([true, false, null])('aceita %s', (answer) => {
    const parsed = createAnamneseSchema.parse(payload({
      gestation: { plannedPregnancy: answer },
      school: { attendsSchool: answer, hasSupportTeacher: answer },
    }));
    expect(parsed.clinicalHistory.gestation.plannedPregnancy).toBe(answer);
  });

  test('"" de um registro antigo vira não respondido', () => {
    const parsed = createAnamneseSchema.parse(payload({ school: { attendsSchool: '' } }));
    expect(parsed.clinicalHistory.school.attendsSchool).toBeNull();
  });
});
