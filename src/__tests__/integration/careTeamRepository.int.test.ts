/**
 * Equipe de cuidado contra Postgres real: as garantias que só o banco dá.
 *
 * O que se prova aqui não cabe num repositório falso — a condição do UPDATE
 * de aceite, o índice parcial que impede participação viva duplicada, a
 * validade comparada com a hora do servidor, e o fato de a revogação
 * PRESERVAR a linha ao mesmo tempo em que some do caseload.
 */

import { v7 as uuidv7 } from 'uuid';
import pool from 'infrastructure/database/connection';
import { PgCareTeamMemberRepository } from 'infrastructure/repositories/PgCareTeamMemberRepository';
import { CareTeamService } from 'application/services/CareTeamService';
import { NotFoundError, InvitationInvalidError } from 'infrastructure/utils/errors/CustomErrors';

const OWNER = `test-owner-${uuidv7()}`;
const OTHER_OWNER = `test-owner-${uuidv7()}`;
const PROFESSIONAL = `test-prof-${uuidv7()}`;
const STRANGER = `test-stranger-${uuidv7()}`;

const childInvite = uuidv7();
const childRevoke = uuidv7();
const childCaseA = uuidv7();
const childCaseB = uuidv7();
const childExpiry = uuidv7();
const childOfOther = uuidv7();

const repo = new PgCareTeamMemberRepository();
const service = new CareTeamService(repo, pool);

beforeAll(async () => {
  await pool.query(
    `INSERT INTO children (id, user_id, name, birth_date) VALUES
       ($1,$7,'Convite','2019-01-01'),
       ($2,$7,'Revogação','2019-02-01'),
       ($3,$7,'Ana','2018-03-15'),
       ($4,$7,'Bruno','2020-05-20'),
       ($5,$7,'Validade','2017-07-07'),
       ($6,$8,'De outro responsável','2016-06-06')`,
    [childInvite, childRevoke, childCaseA, childCaseB, childExpiry, childOfOther, OWNER, OTHER_OWNER],
  );
});

afterAll(async () => {
  // care_team_members some junto (ON DELETE CASCADE em child_id).
  await pool.query(`DELETE FROM children WHERE user_id = ANY($1::text[])`, [[OWNER, OTHER_OWNER]]);
  await pool.end();
});

async function rawRow(id: string): Promise<Record<string, unknown> | undefined> {
  const result = await pool.query(`SELECT * FROM care_team_members WHERE id = $1`, [id]);
  return result.rows[0];
}

describe('só o dono convida', () => {
  test('the owner can invite a professional to their own child', async () => {
    const member = await service.invite(
      childInvite,
      { memberName: 'Dra. Marina', role: 'fonoaudiologia' },
      OWNER,
    );
    expect(member.getStatus()).toBe('pending');
    expect(member.getGrantedByUserId()).toBe(OWNER);
    expect(member.getMemberUserId()).toBeNull();
  });

  test('a stranger cannot invite anyone to a child they do not own', async () => {
    await expect(
      service.invite(childInvite, { memberName: 'Invasor', role: 'outro' }, STRANGER),
    ).rejects.toThrow(NotFoundError);
    const rows = await repo.listForChild(childInvite, OWNER);
    expect(rows).toHaveLength(1);
  });

  test('another responsible party cannot invite into someone else\'s child', async () => {
    await expect(
      service.invite(childInvite, { memberName: 'Dra. Outra', role: 'psicologia' }, OTHER_OWNER),
    ).rejects.toThrow(NotFoundError);
  });

  test('a stranger listing the team of a child they do not own gets nothing at all', async () => {
    await expect(service.listForChild(childInvite, STRANGER)).rejects.toThrow(NotFoundError);
    // Mesmo forçando o repositório, o dono entra na condição da consulta.
    expect(await repo.listForChild(childInvite, STRANGER)).toHaveLength(0);
  });

  test('the listing hands the owner the membership but never the pending token', async () => {
    const [member] = await service.listForChild(childInvite, OWNER);
    const view = member.toListView() as Record<string, unknown>;
    expect(view.memberName).toBe('Dra. Marina');
    expect(view).not.toHaveProperty('invitationToken');
    // O token existe na linha — o que não pode é sair pela listagem.
    expect((await rawRow(member.getId()))?.invitation_token).toEqual(expect.any(String));
  });
});

describe('validade e autoaceite', () => {
  test('an expired token is not accepted, and not even found', async () => {
    const id = uuidv7();
    await pool.query(
      `INSERT INTO care_team_members
         (id, child_id, granted_by_user_id, member_name, role, invitation_token, invitation_expires_at)
       VALUES ($1,$2,$3,'Convite vencido','psicologia',$4, CURRENT_TIMESTAMP - INTERVAL '1 second')`,
      [id, childExpiry, OWNER, 'tok-vencido-aaaaaaaaaaaaaaaa'],
    );

    expect(await repo.findByInvitationToken('tok-vencido-aaaaaaaaaaaaaaaa')).toBeNull();
    await expect(
      service.acceptInvitation('tok-vencido-aaaaaaaaaaaaaaaa', PROFESSIONAL),
    ).rejects.toThrow(InvitationInvalidError);
    // A tentativa não deixou rastro de aceite na linha.
    const row = await rawRow(id);
    expect(row?.member_user_id).toBeNull();
    expect(row?.accepted_at).toBeNull();
  });

  test('the granter cannot accept their own invitation, and the invitation survives the attempt', async () => {
    const member = await service.invite(
      childExpiry,
      { memberName: 'Dra. Marina', role: 'terapia_ocupacional' },
      OWNER,
    );
    const token = member.toOwnerView().invitationToken as string;

    await expect(service.acceptInvitation(token, OWNER)).rejects.toThrow(InvitationInvalidError);

    const row = await rawRow(member.getId());
    expect(row?.member_user_id).toBeNull();
    expect(row?.invitation_token).toBe(token);

    // E quem foi convidado ainda consegue aceitar depois.
    const accepted = await service.acceptInvitation(token, PROFESSIONAL);
    expect(accepted.getMemberUserId()).toBe(PROFESSIONAL);
  });

  test('a token is one-shot: the second accept fails', async () => {
    const member = await service.invite(childInvite, { memberName: 'Dr. Paulo', role: 'fisioterapia' }, OWNER);
    const token = member.toOwnerView().invitationToken as string;
    const other = `test-prof-${uuidv7()}`;

    await service.acceptInvitation(token, other);
    await expect(service.acceptInvitation(token, `test-prof-${uuidv7()}`)).rejects.toThrow(
      InvitationInvalidError,
    );
    expect(await repo.findByInvitationToken(token)).toBeNull();
  });

  test('an invitation revoked before it was accepted can no longer be accepted', async () => {
    const member = await service.invite(childInvite, { memberName: 'Dra. Sofia', role: 'psicopedagogia' }, OWNER);
    const token = member.toOwnerView().invitationToken as string;

    await service.revoke(member.getId(), childInvite, OWNER);
    await expect(service.acceptInvitation(token, `test-prof-${uuidv7()}`)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('the same professional cannot hold two live memberships for one child', async () => {
    const first = await service.invite(childCaseA, { memberName: 'Dra. Marina', role: 'fonoaudiologia' }, OWNER);
    await service.acceptInvitation(first.toOwnerView().invitationToken as string, PROFESSIONAL);

    const second = await service.invite(childCaseA, { memberName: 'Dra. Marina', role: 'psicologia' }, OWNER);
    // O índice parcial único recusa, e a recusa chega como qualquer outra
    // falha de aceite — não como um 409 que confirmaria a participação.
    await expect(
      service.acceptInvitation(second.toOwnerView().invitationToken as string, PROFESSIONAL),
    ).rejects.toThrow(InvitationInvalidError);
  });
});

describe('revogação é soft', () => {
  test('a stranger cannot revoke a membership they did not grant', async () => {
    const member = await service.invite(childRevoke, { memberName: 'Dra. Marina', role: 'psicologia' }, OWNER);

    expect(await repo.revoke(member.getId(), childRevoke, STRANGER)).toBe(false);
    expect(await repo.revoke(member.getId(), childRevoke, OTHER_OWNER)).toBe(false);
    await expect(service.revoke(member.getId(), childRevoke, STRANGER)).rejects.toThrow(NotFoundError);

    expect((await rawRow(member.getId()))?.revoked_at).toBeNull();
  });

  test('a membership id from another child is not reachable through this child\'s route', async () => {
    const member = await service.invite(childRevoke, { memberName: 'Dr. Paulo', role: 'educacao_fisica' }, OWNER);
    expect(await repo.revoke(member.getId(), childCaseB, OWNER)).toBe(false);
    expect((await rawRow(member.getId()))?.revoked_at).toBeNull();
  });

  test('the owner revokes: the row STAYS, with revoked_at and the dates it needs', async () => {
    const member = await service.invite(childRevoke, { memberName: 'Dra. Sofia', role: 'outro' }, OWNER);
    const token = member.toOwnerView().invitationToken as string;
    await service.acceptInvitation(token, `test-prof-${uuidv7()}`);

    await service.revoke(member.getId(), childRevoke, OWNER);

    const row = await rawRow(member.getId());
    expect(row).toBeDefined(); // a linha não foi apagada
    expect(row?.revoked_at).toBeInstanceOf(Date);
    expect(row?.accepted_at).toBeInstanceOf(Date); // quando começou
    expect(row?.created_at).toBeInstanceOf(Date);
    // O token some junto: uma participação revogada não deixa convite vivo.
    expect(row?.invitation_token).toBeNull();

    // E o responsável continua enxergando o histórico.
    const listed = await service.listForChild(childRevoke, OWNER);
    const revoked = listed.find((m) => m.getId() === member.getId());
    expect(revoked?.getStatus()).toBe('revoked');
  });

  test('revoking twice is refused (nothing left to revoke)', async () => {
    const member = await service.invite(childRevoke, { memberName: 'Dr. Enzo', role: 'acompanhante_terapeutico' }, OWNER);
    await service.revoke(member.getId(), childRevoke, OWNER);
    await expect(service.revoke(member.getId(), childRevoke, OWNER)).rejects.toThrow(NotFoundError);
  });
});

describe('caseload do profissional: um login, várias crianças', () => {
  const professional = `test-prof-${uuidv7()}`;

  async function joinTeam(childId: string, role: 'fonoaudiologia' | 'psicologia' | 'outro') {
    const member = await service.invite(childId, { memberName: 'Dra. Helena', role }, OWNER);
    return service.acceptInvitation(member.toOwnerView().invitationToken as string, professional);
  }

  test('a professional with no membership has an empty caseload', async () => {
    expect(await service.listMyChildren(professional)).toEqual([]);
  });

  test('the same professional holds memberships for several children, and my-children returns all of them', async () => {
    await joinTeam(childCaseA, 'psicologia');
    await joinTeam(childCaseB, 'fonoaudiologia');

    const caseload = await service.listMyChildren(professional);
    expect(caseload.map((c) => c.childId).sort()).toEqual([childCaseA, childCaseB].sort());
    // A criança vem nomeada: a lista é para o profissional escolher quem atender.
    expect(caseload.map((c) => c.childName).sort()).toEqual(['Ana', 'Bruno']);
    expect(caseload.find((c) => c.childId === childCaseA)?.role).toBe('psicologia');
    expect(caseload.find((c) => c.childId === childCaseB)?.childBirthDate).toBe('2020-05-20');
    for (const entry of caseload) {
      expect(entry.acceptedAt).toBeInstanceOf(Date);
    }
  });

  test('a caseload never contains a child the professional was not granted', async () => {
    const caseload = await service.listMyChildren(professional);
    expect(caseload.map((c) => c.childId)).not.toContain(childOfOther);
    expect(caseload.map((c) => c.childId)).not.toContain(childRevoke);
  });

  test('a pending invitation does not put a child in anybody\'s caseload', async () => {
    await service.invite(childInvite, { memberName: 'Dra. Helena', role: 'outro' }, OWNER);
    const caseload = await service.listMyChildren(professional);
    expect(caseload.map((c) => c.childId)).not.toContain(childInvite);
  });

  test('a revoked membership disappears from the caseload', async () => {
    const before = await service.listMyChildren(professional);
    const target = before.find((c) => c.childId === childCaseA);
    expect(target).toBeDefined();

    await service.revoke(target!.membershipId, childCaseA, OWNER);

    const after = await service.listMyChildren(professional);
    expect(after.map((c) => c.childId)).toEqual([childCaseB]);
    // ...sem apagar a evidência de que existiu.
    expect((await rawRow(target!.membershipId))?.revoked_at).toBeInstanceOf(Date);
  });

  test('after a revocation the owner can invite the same professional again', async () => {
    // O índice único é parcial justamente para isto: uma relação encerrada
    // não pode impedir que ela recomece.
    const again = await service.invite(childCaseA, { memberName: 'Dra. Helena', role: 'fonoaudiologia' }, OWNER);
    const accepted = await service.acceptInvitation(
      again.toOwnerView().invitationToken as string,
      professional,
    );
    expect(accepted.getMemberUserId()).toBe(professional);

    const caseload = await service.listMyChildren(professional);
    expect(caseload.map((c) => c.childId).sort()).toEqual([childCaseA, childCaseB].sort());
  });
});
