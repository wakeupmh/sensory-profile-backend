/**
 * Integration tests for ReminderDigestService.
 *
 * Tests exercise the service against mock UserProfileRepository,
 * ReminderNotificationRepository, UpcomingReminderService, and EmailService
 * — no real database or SES connection required.
 *
 * Covers:
 *  1.  run() sends nothing when there are no eligible profiles
 *  2.  run() skips a profile with no upcoming reminders (no email sent)
 *  3.  run() sends one email per user with unsent reminders, reserving each key first
 *  4.  run() does not re-send a reminder whose key reservation was already claimed
 *  5.  run() releases the reservation and does not count success when sending fails
 *  6.  a failure processing one user does not stop the digest for other users
 *  7.  digest email lists reminder titles and formatted dates
 */

import { ReminderDigestService } from 'application/services/ReminderDigestService';
import { UserProfile } from 'domain/entities/UserProfile';
import type { UserProfileRepository } from 'domain/repositories/UserProfileRepository';
import type { ReminderNotificationRepository } from 'domain/repositories/ReminderNotificationRepository';
import type { UpcomingReminderService, UpcomingReminderItem } from 'application/services/UpcomingReminderService';
import type { EmailService } from 'infrastructure/email/EmailService';

const NOW_ISO = '2024-06-15T10:00:00.000Z';

function makeProfile(overrides: Record<string, unknown> = {}): UserProfile {
  return new UserProfile({
    userId: 'user-001',
    email: 'user@example.com',
    reminderEmailsEnabled: true,
    createdAt: new Date(NOW_ISO),
    updatedAt: new Date(NOW_ISO),
    ...overrides,
  });
}

function makeItem(overrides: Partial<UpcomingReminderItem> = {}): UpcomingReminderItem {
  return {
    source: 'custom',
    type: 'custom',
    id: 'reminder-001',
    childId: 'child-001',
    title: 'Consulta com neuropediatra',
    dueAt: '2024-06-17T00:00:00.000Z',
    resourceType: null,
    resourceId: null,
    ...overrides,
  };
}

function makeUserProfileRepo(overrides: Partial<UserProfileRepository> = {}): UserProfileRepository {
  return {
    upsertEmail: jest.fn().mockResolvedValue(undefined),
    findByUserId: jest.fn().mockResolvedValue(null),
    setReminderEmailsEnabled: jest.fn(),
    findAllEligibleForReminders: jest.fn().mockResolvedValue([makeProfile()]),
    ...overrides,
  };
}

function makeNotificationRepo(overrides: Partial<ReminderNotificationRepository> = {}): ReminderNotificationRepository {
  return {
    reserve: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeUpcomingService(items: UpcomingReminderItem[] = [makeItem()]): UpcomingReminderService {
  return { getUpcoming: jest.fn().mockResolvedValue(items) } as unknown as UpcomingReminderService;
}

function makeEmailService(overrides: Partial<EmailService> = {}): EmailService {
  return { sendEmail: jest.fn().mockResolvedValue(undefined), ...overrides } as unknown as EmailService;
}

describe('ReminderDigestService', () => {
  test('sends nothing when there are no eligible profiles', async () => {
    const userProfileRepo = makeUserProfileRepo({ findAllEligibleForReminders: jest.fn().mockResolvedValue([]) });
    const emailService = makeEmailService();
    const service = new ReminderDigestService(
      userProfileRepo,
      makeNotificationRepo(),
      makeUpcomingService(),
      emailService,
    );

    const result = await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ usersChecked: 0, usersNotified: 0, emailsSent: 0, emailsFailed: 0 });
  });

  test('skips a profile with no upcoming reminders — no email sent', async () => {
    const emailService = makeEmailService();
    const service = new ReminderDigestService(
      makeUserProfileRepo(),
      makeNotificationRepo(),
      makeUpcomingService([]),
      emailService,
    );

    const result = await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(result.usersNotified).toBe(0);
    expect(result.emailsSent).toBe(0);
  });

  test('sends one email per user with unsent reminders, reserving each key first', async () => {
    const notificationRepo = makeNotificationRepo();
    const emailService = makeEmailService();
    const items = [makeItem({ id: 'r1' }), makeItem({ id: 'r2', title: 'Fim da medicação' })];
    const service = new ReminderDigestService(
      makeUserProfileRepo(),
      notificationRepo,
      makeUpcomingService(items),
      emailService,
    );

    const result = await service.run();

    expect(notificationRepo.reserve).toHaveBeenCalledWith('user-001', 'custom:custom:r1');
    expect(notificationRepo.reserve).toHaveBeenCalledWith('user-001', 'custom:custom:r2');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('2'),
      expect.any(String),
    );
    expect(result.usersNotified).toBe(1);
    expect(result.emailsSent).toBe(1);
  });

  test('does not re-send a reminder whose key reservation was already claimed', async () => {
    const notificationRepo = makeNotificationRepo({ reserve: jest.fn().mockResolvedValue(false) });
    const emailService = makeEmailService();
    const service = new ReminderDigestService(
      makeUserProfileRepo(),
      notificationRepo,
      makeUpcomingService([makeItem()]),
      emailService,
    );

    await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('releases the reservation and does not count success when sending fails', async () => {
    const notificationRepo = makeNotificationRepo();
    const emailService = makeEmailService({ sendEmail: jest.fn().mockRejectedValue(new Error('SES down')) });
    const service = new ReminderDigestService(
      makeUserProfileRepo(),
      notificationRepo,
      makeUpcomingService([makeItem({ id: 'r1' })]),
      emailService,
    );

    const result = await service.run();

    expect(notificationRepo.release).toHaveBeenCalledWith('user-001', 'custom:custom:r1');
    expect(result.emailsSent).toBe(0);
    expect(result.emailsFailed).toBe(1);
    expect(result.usersNotified).toBe(0);
  });

  test('a failure processing one user does not stop the digest for other users', async () => {
    const profiles = [
      makeProfile({ userId: 'user-broken', email: 'broken@example.com' }),
      makeProfile({ userId: 'user-ok', email: 'ok@example.com' }),
    ];
    const userProfileRepo = makeUserProfileRepo({
      findAllEligibleForReminders: jest.fn().mockResolvedValue(profiles),
    });
    const upcomingService = {
      getUpcoming: jest
        .fn()
        .mockRejectedValueOnce(new Error('DB exploded for user-broken'))
        .mockResolvedValueOnce([makeItem()]),
    } as unknown as UpcomingReminderService;
    const emailService = makeEmailService();
    const service = new ReminderDigestService(
      userProfileRepo,
      makeNotificationRepo(),
      upcomingService,
      emailService,
    );

    const result = await service.run();

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith('ok@example.com', expect.any(String), expect.any(String));
    expect(result.usersChecked).toBe(2);
    expect(result.usersNotified).toBe(1);
  });

  test('digest email lists reminder titles and formatted dates', async () => {
    const emailService = makeEmailService();
    const service = new ReminderDigestService(
      makeUserProfileRepo(),
      makeNotificationRepo(),
      makeUpcomingService([
        makeItem({ id: 'r1', title: 'Consulta com neuropediatra', dueAt: '2024-06-17T00:00:00.000Z' }),
      ]),
      emailService,
    );

    await service.run();

    const body = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
    expect(body).toContain('Consulta com neuropediatra');
    expect(body).toContain('17/06/2024');
  });
});
