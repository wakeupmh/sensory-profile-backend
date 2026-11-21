/**
 * Coluna `date` é dia de calendário: a API devolve "YYYY-MM-DD", não um
 * timestamp UTC que o front lê como o dia anterior (ou "Invalid Date").
 */
import { randomUUID } from 'crypto';
import { MedicationService } from 'application/services/MedicationService';
import { PgMedicationRepository } from 'infrastructure/repositories/PgMedicationRepository';
import pool from 'infrastructure/database/connection';

const owner = randomUUID();
const childId = randomUUID();
const service = new MedicationService(new PgMedicationRepository());

beforeAll(async () => {
  await pool.query(`INSERT INTO children (id, user_id, name) VALUES ($1, $2, 'Criança teste')`, [childId, owner]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM children WHERE id = $1`, [childId]);
  await pool.end();
});

test('startDate volta como o dia gravado', async () => {
  const med = await service.create({ childId, name: 'Melatonina', startDate: '2026-03-10' }, owner);
  expect(med.toJSON()).toMatchObject({ startDate: '2026-03-10' });
});
