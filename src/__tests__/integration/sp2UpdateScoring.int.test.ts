/**
 * Editar as respostas de uma avaliação SP-2 precisa recalcular as nove
 * pontuações brutas a partir das respostas novas — não zerá-las.
 */
import 'instruments';
import { randomUUID } from 'crypto';
import { AssessmentService } from 'application/services/AssessmentService';
import { PgAssessmentRepository } from 'infrastructure/repositories/PgAssessmentRepository';
import { PgResponseRepository } from 'infrastructure/repositories/PgResponseRepository';
import { ChildService } from 'application/services/ChildService';
import { ExaminerService } from 'application/services/ExaminerService';
import { CaregiverService } from 'application/services/CaregiverService';
import { SectionCommentService } from 'application/services/SectionCommentService';
import pool from 'infrastructure/database/connection';

const userId = randomUUID();
const service = new AssessmentService(
  new PgAssessmentRepository(),
  new PgResponseRepository(),
  new ChildService(),
  new ExaminerService(),
  new CaregiverService(),
  new SectionCommentService(),
);

// Itens 1–86; 15 e 86 não pontuam.
const allItems = (response: string) =>
  Array.from({ length: 86 }, (_, i) => ({ itemId: i + 1, response }));

afterAll(async () => {
  await pool.query(`DELETE FROM sensory_assessments WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM children WHERE user_id = $1`, [userId]);
  await pool.end();
});

test('PUT com respostas novas recalcula as pontuações SP-2', async () => {
  const created = await service.createAssessment(
    {
      child: { name: 'Criança teste', birthDate: '2019-05-01' },
      responses: allItems('quase nunca'),
    },
    userId,
  );
  expect(created.getAuditoryProcessingRawScore()).toBe(8);

  const updated = await service.updateAssessment(
    created.getId()!,
    { responses: allItems('frequentemente') },
    userId,
  );

  // 8 itens auditivos × 4 ("frequentemente")
  expect(updated.getAuditoryProcessingRawScore()).toBe(32);
  expect(updated.getAttentionResponsesRawScore()).toBe(40);
});

test('"não se aplica" sai do total sem barrar a criação', async () => {
  const responses = allItems('quase nunca');
  responses[0] = { itemId: 1, response: 'não se aplica' };
  const created = await service.createAssessment(
    { child: { name: 'Criança teste', birthDate: '2019-05-01' }, responses },
    userId,
  );
  expect(created.getAuditoryProcessingRawScore()).toBe(7);
});

test('respostas lidas do banco trazem itemId numérico, como a entidade declara', async () => {
  const created = await service.createAssessment(
    { child: { name: 'Criança teste', birthDate: '2019-05-01' }, responses: allItems('quase nunca') },
    userId,
  );
  const { responses } = await service.getAssessmentWithResponses(created.getId()!, userId);
  expect(responses[0].getItemId()).toEqual(expect.any(Number));
});
