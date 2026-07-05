/**
 * Integration tests for CaregiverShareService.
 *
 * Tests exercise the service against a mock CaregiverShareRepository and a
 * fake pg Pool — no real database connection required.
 *
 * Covers:
 *  1. invite throws NotFoundError when child does not belong to owner
 *  2. invite saves with a fresh token and a ~14-day expiry
 *  3. acceptInvitation throws InvitationInvalidError for unknown token
 *  4. acceptInvitation throws InvitationInvalidError when accepting own invitation
 *  5. acceptInvitation throws InvitationInvalidError on racy double-accept (repo returns null)
 *  6. acceptInvitation returns the accepted share on success
 *  7. revoke throws NotFoundError when nothing was deleted
 *  8. resolveEffectiveOwner returns the caller's own id when they own the child
 *  9. resolveEffectiveOwner returns the resolved owner when caller is an accepted caregiver
 * 10. resolveEffectiveOwner returns null when caller has no relationship to the child
 */

import { CaregiverShareService } from 'application/services/CaregiverShareService';
import { CaregiverShare } from 'domain/entities/CaregiverShare';
import type { CaregiverShareRepository } from 'domain/repositories/CaregiverShareRepository';
import { NotFoundError, InvitationInvalidError } from 'infrastructure/utils/errors/CustomErrors';

const OWNER_ID = 'owner-001';
const OTHER_USER_ID = 'user-999';
const CHILD_ID = '018f4e8a-0000-7000-8000-aaaaaaaaaaaa';
const SHARE_ID = '018f4e8a-0000-7000-8000-000000000001';
const NOW = new Date('2024-06-15T10:30:00.000Z');

function makeShare(overrides: Record<string, unknown> = {}): CaregiverShare {
  return new CaregiverShare({
    id: SHARE_ID,
    childId: CHILD_ID,
    ownerUserId: OWNER_ID,
    caregiverName: 'Avó Maria',
    caregiverUserId: null,
    invitationToken: 'tok_abc123',
    invitationExpiresAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeRepo(overrides: Partial<CaregiverShareRepository> = {}): CaregiverShareRepository {
  return {
    save: jest.fn().mockResolvedValue(makeShare()),
    findByInvitationToken: jest.fn().mockResolvedValue(null),
    acceptInvitation: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(true),
    listForChild: jest.fn().mockResolvedValue([]),
    resolveOwner: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// Minimal fake Pool — CaregiverShareService only calls pool.query for the
// "does this child belong to this user" ownership check.
function makePool(ownedByUserIds: string[] = [OWNER_ID]) {
  return {
    query: jest.fn().mockImplementation((_sql: string, params: unknown[]) => {
      const userId = params[1] as string;
      return Promise.resolve({ rows: ownedByUserIds.includes(userId) ? [{ 1: 1 }] : [] });
    }),
  } as unknown as import('pg').Pool;
}

function makeService(opts: {
  repo?: Partial<CaregiverShareRepository>;
  ownedByUserIds?: string[];
} = {}): CaregiverShareService {
  return new CaregiverShareService(makeRepo(opts.repo), makePool(opts.ownedByUserIds ?? [OWNER_ID]));
}

describe('CaregiverShareService', () => {
  test('invite throws NotFoundError when child does not belong to owner', async () => {
    const service = makeService({ ownedByUserIds: [] });
    await expect(service.invite(CHILD_ID, 'Avó Maria', OWNER_ID)).rejects.toThrow(NotFoundError);
  });

  test('invite saves with a fresh token and a ~14-day expiry', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });
    await service.invite(CHILD_ID, 'Avó Maria', OWNER_ID);

    const saveArg = (repo.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.childId).toBe(CHILD_ID);
    expect(saveArg.ownerUserId).toBe(OWNER_ID);
    expect(saveArg.caregiverName).toBe('Avó Maria');
    expect(typeof saveArg.invitationToken).toBe('string');
    expect(saveArg.invitationToken.length).toBeGreaterThan(10);

    const expiresInDays =
      (saveArg.invitationExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(expiresInDays).toBeGreaterThan(13.9);
    expect(expiresInDays).toBeLessThan(14.1);
  });

  test('acceptInvitation throws InvitationInvalidError for unknown token', async () => {
    const repo = makeRepo({ findByInvitationToken: jest.fn().mockResolvedValue(null) });
    const service = makeService({ repo });
    await expect(service.acceptInvitation('bogus-token', OTHER_USER_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('acceptInvitation throws InvitationInvalidError when accepting own invitation', async () => {
    const repo = makeRepo({ findByInvitationToken: jest.fn().mockResolvedValue(makeShare()) });
    const service = makeService({ repo });
    // OWNER_ID is both the inviter and the one trying to accept
    await expect(service.acceptInvitation('tok_abc123', OWNER_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('acceptInvitation throws InvitationInvalidError on racy double-accept', async () => {
    const repo = makeRepo({
      findByInvitationToken: jest.fn().mockResolvedValue(makeShare()),
      acceptInvitation: jest.fn().mockResolvedValue(null), // another request won the race
    });
    const service = makeService({ repo });
    await expect(service.acceptInvitation('tok_abc123', OTHER_USER_ID)).rejects.toThrow(
      InvitationInvalidError,
    );
  });

  test('acceptInvitation returns the accepted share on success', async () => {
    const accepted = makeShare({ caregiverUserId: OTHER_USER_ID, acceptedAt: NOW, invitationToken: null });
    const repo = makeRepo({
      findByInvitationToken: jest.fn().mockResolvedValue(makeShare()),
      acceptInvitation: jest.fn().mockResolvedValue(accepted),
    });
    const service = makeService({ repo });
    const result = await service.acceptInvitation('tok_abc123', OTHER_USER_ID);
    expect(result.getCaregiverUserId()).toBe(OTHER_USER_ID);
  });

  test('revoke throws NotFoundError when nothing was deleted', async () => {
    const repo = makeRepo({ revoke: jest.fn().mockResolvedValue(false) });
    const service = makeService({ repo });
    await expect(service.revoke(SHARE_ID, OWNER_ID)).rejects.toThrow(NotFoundError);
  });

  test('resolveEffectiveOwner returns the caller\'s own id when they own the child', async () => {
    const repo = makeRepo();
    const service = makeService({ repo, ownedByUserIds: [OWNER_ID] });
    const result = await service.resolveEffectiveOwner(CHILD_ID, OWNER_ID);
    expect(result).toBe(OWNER_ID);
    expect(repo.resolveOwner).not.toHaveBeenCalled();
  });

  test('resolveEffectiveOwner returns the resolved owner when caller is an accepted caregiver', async () => {
    const repo = makeRepo({ resolveOwner: jest.fn().mockResolvedValue(OWNER_ID) });
    const service = makeService({ repo, ownedByUserIds: [] });
    const result = await service.resolveEffectiveOwner(CHILD_ID, OTHER_USER_ID);
    expect(result).toBe(OWNER_ID);
  });

  test('resolveEffectiveOwner returns null when caller has no relationship to the child', async () => {
    const repo = makeRepo({ resolveOwner: jest.fn().mockResolvedValue(null) });
    const service = makeService({ repo, ownedByUserIds: [] });
    const result = await service.resolveEffectiveOwner(CHILD_ID, OTHER_USER_ID);
    expect(result).toBeNull();
  });
});
