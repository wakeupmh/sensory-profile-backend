/**
 * A fronteira que a clínica NÃO atravessa.
 *
 * A feature inteira se resume a uma frase: a clínica administra pessoas, e o
 * dado continua sendo do responsável. Um admin de clínica vê o quadro e o
 * TAMANHO do caseload de cada profissional; para ver o dado de uma criança ele
 * precisa que o responsável daquela criança o convide para a equipe de
 * cuidado, como qualquer outra pessoa.
 *
 * Isso é fácil de dizer e fácil de perder — bastaria alguém "resolver" a
 * clínica junto com a concessão no `careTeamScopeMiddleware` para virar um
 * caminho de acesso, e nada quebraria: só passaria a mostrar mais. Por isso
 * este arquivo cobra dos dois lados, o estrutural e o de comportamento.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PgDailyLogRepository } from 'infrastructure/repositories/PgDailyLogRepository';
import { PgChildRepository } from 'infrastructure/repositories/PgChildRepository';
import { PgClinicRepository } from 'infrastructure/repositories/PgClinicRepository';
import { ClinicService } from 'application/services/ClinicService';
import { CHILD_SCOPED_TABLES } from 'infrastructure/repositories/queryUtils';
import { runWithScope } from 'infrastructure/database/requestScope';
import { AccountErasureService } from 'application/services/AccountErasureService';
import type { S3StorageService } from 'infrastructure/storage/S3StorageService';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logs = new PgDailyLogRepository();
const children = new PgChildRepository();
const clinics = new PgClinicRepository();
const service = new ClinicService(clinics);

const parent = 'parent-' + randomUUID().slice(0, 8);
const admin = 'admin-' + randomUUID().slice(0, 8);
const therapist = 'therapist-' + randomUUID().slice(0, 8);
const outsider = 'outsider-' + randomUUID().slice(0, 8);

const childId = randomUUID();
const logId = randomUUID();
let clinicId: string;

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id,user_id,name,birth_date) VALUES ($1,$2,'Criança da Família','2019-01-01')`,
    [childId, parent],
  );
  await pool.query(
    `INSERT INTO daily_logs (id,user_id,child_id,log_type,occurred_at,data,notes)
     VALUES ($1,$2,$3,'mood',NOW(),'{}','registro da família')`,
    [logId, parent, childId],
  );

  // A clínica, com um admin e um profissional no quadro.
  const clinic = await service.create('Clínica Teste', admin);
  clinicId = clinic.getId();
  const invite = await service.invite(clinicId, { memberName: 'Dra. Helena', role: 'profissional' }, admin);
  await service.acceptInvitation(invite.toInviteView().invitationToken!, therapist);

  // E o responsável concede acesso À PROFISSIONAL — não à clínica.
  await pool.query(
    `INSERT INTO care_team_members (id, child_id, granted_by_user_id, member_name, role, member_user_id, accepted_at)
     VALUES ($1,$2,$3,'Dra. Helena','fonoaudiologia',$4,CURRENT_TIMESTAMP)`,
    [randomUUID(), childId, parent, therapist],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM children WHERE id = $1', [childId]);
  await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
  await pool.end();
});

describe('estrutura: a clínica não entra na resolução de escopo', () => {
  const SRC = join(__dirname, '..', '..');

  test('queryUtils não conhece a clínica', () => {
    const source = readFileSync(join(SRC, 'infrastructure', 'repositories', 'queryUtils.ts'), 'utf8');
    expect(source).not.toMatch(/clinic/i);
  });

  test('o middleware de concessão não conhece a clínica', () => {
    const source = readFileSync(
      join(SRC, 'interfaces', 'http', 'middleware', 'careTeamScopeMiddleware.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/clinic/i);
  });

  test('as tabelas da clínica não são child-scoped — não têm criança nenhuma', () => {
    expect(CHILD_SCOPED_TABLES.has('clinics')).toBe(false);
    expect(CHILD_SCOPED_TABLES.has('clinic_members')).toBe(false);
  });

  test('as tabelas da clínica realmente não têm child_id', async () => {
    // Se um dia ganharem, o teste de cobertura da delegação vai cobrar uma
    // decisão — e esta asserção aqui explica por que a resposta seria "não".
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'child_id'
          AND table_name IN ('clinics','clinic_members')`,
    );
    expect(rows).toEqual([]);
  });
});

describe('comportamento: ser admin não alcança dado de criança', () => {
  /** O escopo que o middleware monta para alguém SEM concessão nenhuma. */
  const asAdmin = <T>(fn: () => Promise<T>) =>
    runWithScope({ actingUserId: admin, careTeamChildIds: [] }, fn);

  test('o admin não lê o registro da criança que a profissional dele atende', async () => {
    expect(await asAdmin(() => logs.findById(logId, admin))).toBeNull();
  });

  test('o admin não abre a ficha dessa criança', async () => {
    expect(await asAdmin(() => children.findById(childId, admin))).toBeNull();
  });

  test('o admin não altera o registro dessa criança', async () => {
    const updated = await asAdmin(() =>
      logs.update(logId, admin, { notes: 'ALTERADO PELO ADMIN DA CLINICA' }),
    );
    expect(updated).toBeNull();

    const { rows } = await pool.query('SELECT notes FROM daily_logs WHERE id = $1', [logId]);
    expect(rows[0].notes).toBe('registro da família');
  });

  test('a profissional, essa sim, alcança — porque o RESPONSÁVEL concedeu', async () => {
    const log = await runWithScope(
      { actingUserId: therapist, careTeamChildIds: [childId] },
      () => logs.findById(logId, therapist),
    );
    expect(log).not.toBeNull();
  });
});

describe('o quadro mostra número, não identidade', () => {
  test('o admin vê quantas crianças a profissional atende, e não quais', async () => {
    const roster = await service.listRoster(clinicId, admin);
    const helena = roster.find((e) => e.member.getMemberUserId() === therapist);
    expect(helena).toBeDefined();

    const view = helena!.member.toRosterView(helena!.caseloadSize);
    expect(view.caseloadSize).toBe(1);

    // Nada da criança pode aparecer aqui: nem id, nem nome.
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(childId);
    expect(serialised).not.toContain('Criança da Família');
  });

  test('o quadro não devolve o token do convite', async () => {
    const invite = await service.invite(clinicId, { memberName: 'Pendente', role: 'profissional' }, admin);
    expect(invite.toInviteView().invitationToken).toBeTruthy();

    const roster = await service.listRoster(clinicId, admin);
    for (const entry of roster) {
      expect(entry.member.toRosterView(entry.caseloadSize)).not.toHaveProperty('invitationToken');
    }
  });
});

describe('só admin ativo administra', () => {
  test('a profissional do quadro não administra a clínica', async () => {
    await expect(service.listRoster(clinicId, therapist)).rejects.toThrow();
    await expect(
      service.invite(clinicId, { memberName: 'X', role: 'profissional' }, therapist),
    ).rejects.toThrow();
  });

  test('quem não é da clínica não administra nem descobre que ela existe', async () => {
    await expect(service.listRoster(clinicId, outsider)).rejects.toThrow();
  });

  test('quem saiu do quadro para de administrar na hora', async () => {
    const invite = await service.invite(clinicId, { memberName: 'Outro Admin', role: 'admin' }, admin);
    const second = 'admin2-' + randomUUID().slice(0, 8);
    await service.acceptInvitation(invite.toInviteView().invitationToken!, second);

    // Enquanto está no quadro, administra.
    await expect(service.listRoster(clinicId, second)).resolves.toBeDefined();

    const roster = await service.listRoster(clinicId, admin);
    const row = roster.find((e) => e.member.getMemberUserId() === second)!;
    await service.revokeMember(row.member.getId(), clinicId, admin);

    await expect(service.listRoster(clinicId, second)).rejects.toThrow();
  });
});

describe('convite da clínica', () => {
  test('um token não é aceito duas vezes', async () => {
    const invite = await service.invite(clinicId, { memberName: 'Uma Vez', role: 'profissional' }, admin);
    const token = invite.toInviteView().invitationToken!;
    await service.acceptInvitation(token, 'user-' + randomUUID().slice(0, 8));
    await expect(service.acceptInvitation(token, 'user-' + randomUUID().slice(0, 8))).rejects.toThrow();
  });

  test('token desconhecido falha igual a token gasto', async () => {
    await expect(service.acceptInvitation('token-que-nao-existe', outsider)).rejects.toThrow();
  });
});

describe('eliminação de conta (LGPD Art. 18 VI)', () => {
  /** Quem sai do quadro não tem criança nem documento — o stub basta. */
  function storageStub(): S3StorageService {
    return {
      deleteObject: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn(),
      getDownloadUrl: jest.fn(),
      getUploadUrl: jest.fn(),
    } as unknown as S3StorageService;
  }

  test('quem apaga a conta sai do quadro, e a clínica continua de pé', async () => {
    const leaving = 'leaving-' + randomUUID().slice(0, 8);
    const invite = await service.invite(clinicId, { memberName: 'Vai Embora', role: 'profissional' }, admin);
    await service.acceptInvitation(invite.toInviteView().invitationToken!, leaving);

    await new AccountErasureService(pool, storageStub()).eraseAccount(leaving);

    const { rows } = await pool.query(
      `SELECT member_user_id, revoked_at, member_name FROM clinic_members
        WHERE clinic_id = $1 AND member_name = 'Vai Embora'`,
      [clinicId],
    );
    expect(rows).toHaveLength(1);
    // A linha fica — é do quadro da clínica, e a trilha precisa saber que
    // alguém esteve ali — mas para de apontar para quem pediu a eliminação.
    expect(rows[0].member_user_id).toBeNull();
    expect(rows[0].revoked_at).not.toBeNull();

    const clinic = await pool.query('SELECT 1 FROM clinics WHERE id = $1', [clinicId]);
    expect(clinic.rows).toHaveLength(1);
  });

  test('o admin que criou a clínica pode sair sem levar a clínica junto', async () => {
    const founder = 'founder-' + randomUUID().slice(0, 8);
    const own = await service.create('Clínica do Fundador', founder);

    await new AccountErasureService(pool, storageStub()).eraseAccount(founder);

    const { rows } = await pool.query('SELECT created_by_user_id FROM clinics WHERE id = $1', [own.getId()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].created_by_user_id).toBeNull();

    await pool.query('DELETE FROM clinics WHERE id = $1', [own.getId()]);
  });
});
