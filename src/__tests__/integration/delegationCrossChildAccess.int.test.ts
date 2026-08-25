/**
 * A falha que este escopo existe para fechar, contra Postgres real.
 *
 * Sob delegação, `requireUserId` resolve para o id do DONO, e as consultas
 * que endereçam um registro pelo próprio `:id` faziam
 * `WHERE id = $1 AND user_id = $2` — sem dimensão de criança. Um cuidador
 * convidado para a criança A alcançava qualquer registro das outras crianças
 * do dono bastando saber o id.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { PgDailyLogRepository } from 'infrastructure/repositories/PgDailyLogRepository';
import { PgDocumentRepository } from 'infrastructure/repositories/PgDocumentRepository';
import { runWithScope } from 'infrastructure/database/requestScope';
import { DailyReportService } from 'application/services/DailyReportService';
import type { S3StorageService } from 'infrastructure/storage/S3StorageService';
import type { TranscriptionService } from 'infrastructure/transcription/TranscriptionService';
import type { AISummaryService } from 'application/services/AISummaryService';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const owner = 'owner-' + randomUUID().slice(0, 8);
const childA = randomUUID();
const childB = randomUUID();
const logB = randomUUID();
const docB = randomUUID();
const reportB = randomUUID();

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id,user_id,name,birth_date)
     VALUES ($1,$2,'Crianca A','2019-01-01'),($3,$2,'Crianca B','2021-01-01')`,
    [childA, owner, childB],
  );
  await pool.query(
    `INSERT INTO daily_logs (id,user_id,child_id,log_type,occurred_at,data,notes)
     VALUES ($1,$2,$3,'mood',NOW(),'{}','registro privado da B')`,
    [logB, owner, childB],
  );
  await pool.query(
    `INSERT INTO documents (id,user_id,child_id,title,storage_key,mime_type)
     VALUES ($1,$2,$3,'Laudo da B','documents/x/b.pdf','application/pdf')`,
    [docB, owner, childB],
  );
  await pool.query(
    `INSERT INTO daily_reports (id,user_id,child_id,report_date,status,transcript)
     VALUES ($1,$2,$3,'2026-08-24','ready','relato privado da B')`,
    [reportB, owner, childB],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM children WHERE user_id = $1', [owner]);
  await pool.end();
});

describe('acesso entre crianças sob delegação', () => {
  const logs = new PgDailyLogRepository();
  const docs = new PgDocumentRepository();

  test('the owner can still read their own records', async () => {
    expect(await logs.findById(logB, owner)).not.toBeNull();
    expect(await docs.findById(docB, owner)).not.toBeNull();
  });

  test("a caregiver delegated to child A cannot read child B's log by id", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      expect(await logs.findById(logB, owner)).toBeNull();
    });
  });

  test("a caregiver delegated to child A cannot read child B's document by id", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      expect(await docs.findById(docB, owner)).toBeNull();
    });
  });

  test("a caregiver delegated to child A cannot DELETE child B's log by id", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      expect(await logs.delete(logB, owner)).toBe(false);
    });
    // E o registro continua lá.
    expect(await logs.findById(logB, owner)).not.toBeNull();
  });

  test('delegation to the right child still works normally', async () => {
    await runWithScope({ restrictedToChildId: childB }, async () => {
      expect(await logs.findById(logB, owner)).not.toBeNull();
    });
  });
});

/**
 * `DailyReportService` fala com o banco diretamente, sem passar por um
 * repositório — então a correção que cobriu os `Pg*Repository` não o alcançou,
 * e o relato do dia seguiu acessível entre crianças pelo `:id`.
 */
describe('relato do dia entre crianças sob delegação', () => {
  const service = new DailyReportService(
    pool,
    {} as S3StorageService,
    {} as TranscriptionService,
    {} as AISummaryService,
  );

  test('the owner can read their own report', async () => {
    expect((await service.get(owner, reportB)).transcript).toBe('relato privado da B');
  });

  test("a caregiver delegated to child A cannot read child B's report by id", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      await expect(service.get(owner, reportB)).rejects.toThrow();
    });
  });

  test("a caregiver delegated to child A cannot edit child B's transcript", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      await expect(service.updateTranscript(owner, reportB, 'texto injetado')).rejects.toThrow();
    });
    const { rows } = await pool.query('SELECT transcript FROM daily_reports WHERE id = $1', [reportB]);
    expect(rows[0].transcript).toBe('relato privado da B');
  });

  test("a caregiver delegated to child A cannot delete child B's report", async () => {
    await runWithScope({ restrictedToChildId: childA }, async () => {
      await expect(service.delete(owner, reportB)).rejects.toThrow();
    });
    const { rowCount } = await pool.query('SELECT 1 FROM daily_reports WHERE id = $1', [reportB]);
    expect(rowCount).toBe(1);
  });
});
