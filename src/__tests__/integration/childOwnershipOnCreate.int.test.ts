/**
 * `childId` no corpo de um POST só era validado pela FK (a criança existe),
 * não pela propriedade: qualquer usuário autenticado conseguia gravar linhas
 * na criança de outro. Estes casos rodam contra o banco de verdade.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { MedicationService } from 'application/services/MedicationService';
import { PgMedicationRepository } from 'infrastructure/repositories/PgMedicationRepository';
import { NotFoundError } from 'infrastructure/utils/errors/CustomErrors';
import { runWithScope } from 'infrastructure/database/requestScope';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = randomUUID();
const stranger = randomUUID();
const childId = randomUUID();
const service = new MedicationService(new PgMedicationRepository());

beforeAll(async () => {
  await pool.query(`INSERT INTO children (id, user_id, name) VALUES ($1, $2, 'Criança teste')`, [childId, owner]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM children WHERE id = $1`, [childId]);
  await pool.end();
});

describe('criação com childId', () => {
  test('o dono cria', async () => {
    const med = await service.create({ childId, name: 'Melatonina' }, owner);
    expect(med.toJSON()).toMatchObject({ childId });
  });

  test('outro usuário recebe 404 e nada é gravado', async () => {
    await expect(service.create({ childId, name: 'Intruso' }, stranger)).rejects.toThrow(NotFoundError);
    const rows = await pool.query(`SELECT 1 FROM medications WHERE child_id = $1 AND name = 'Intruso'`, [childId]);
    expect(rows.rowCount).toBe(0);
  });

  test('concessão ativa do care team na requisição permite escrever', async () => {
    const med = await runWithScope({ careTeamChildIds: [childId] }, () =>
      service.create({ childId, name: 'Da equipe' }, stranger),
    );
    expect(med.toJSON()).toMatchObject({ childId });
  });
});
