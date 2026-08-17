/**
 * Integration tests for ReminderDigestService.
 *
 * Tests exercise the service against mock UserProfileRepository,
 * ReminderNotificationRepository, PushSubscriptionRepository,
 * UpcomingReminderService, EmailService, and WebPushService — no real
 * database, SES, or push service connection required.
 *
 * Covers:
 *  1.  run() sends nothing when there are no eligible profiles or push subscriptions
 *  2.  run() skips a user with no upcoming reminders (no email/push sent)
 *  3.  run() sends one email per user with unsent reminders, reserving each key first (email channel)
 *  4.  run() does not re-send an email whose (channel-scoped) reservation was already claimed
 *  5.  run() releases the email reservation and does not count success when sending fails
 *  6.  a failure processing one user does not stop the digest for other users
 *  7.  digest email lists reminder titles and formatted dates
 *  8.  run() sends push to every device a user has subscribed
 *  9.  a user with both email and an active push subscription gets both — independent reservations
 *  10. a subscription reported gone (410) is deleted and does not block the other device
 *  11. push send failure releases the push-channel reservation for retry
 */

import { ReminderDigestService } from 'application/services/ReminderDigestService';
import { UserProfile } from 'domain/entities/UserProfile';
import { PushSubscription } from 'domain/entities/PushSubscription';
import type { UserProfileRepository } from 'domain/repositories/UserProfileRepository';
import type { ReminderChannel, ReminderNotificationRepository } from 'domain/repositories/ReminderNotificationRepository';
import type { PushSubscriptionRepository } from 'domain/repositories/PushSubscriptionRepository';
import type { UpcomingReminderService, UpcomingReminderItem } from 'application/services/UpcomingReminderService';
import type { EmailService } from 'infrastructure/email/EmailService';
import { PushSubscriptionGoneError, WebPushService } from 'infrastructure/push/WebPushService';

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

function makeSubscription(overrides: Record<string, unknown> = {}): PushSubscription {
  return new PushSubscription({
    id: 'sub-001',
    userId: 'user-001',
    endpoint: 'https://push.example.com/ep-1',
    p256dhKey: 'p256dh-key',
    authKey: 'auth-key',
    createdAt: new Date(NOW_ISO),
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

function makePushSubscriptionRepo(overrides: Partial<PushSubscriptionRepository> = {}): PushSubscriptionRepository {
  return {
    upsert: jest.fn(),
    deleteByEndpoint: jest.fn(),
    deleteById: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeUpcomingService(items: UpcomingReminderItem[] = [makeItem()]): UpcomingReminderService {
  return { getUpcoming: jest.fn().mockResolvedValue(items) } as unknown as UpcomingReminderService;
}

function makeEmailService(overrides: Partial<EmailService> = {}): EmailService {
  return { sendEmail: jest.fn().mockResolvedValue(undefined), ...overrides } as unknown as EmailService;
}

function makeWebPushService(overrides: Partial<WebPushService> = {}): WebPushService {
  return { send: jest.fn().mockResolvedValue(undefined), ...overrides } as unknown as WebPushService;
}

function buildService(opts: {
  userProfileRepo?: UserProfileRepository;
  notificationRepo?: ReminderNotificationRepository;
  upcomingService?: UpcomingReminderService;
  emailService?: EmailService;
  pushSubscriptionRepo?: PushSubscriptionRepository;
  webPushService?: WebPushService;
} = {}): ReminderDigestService {
  return new ReminderDigestService(
    opts.userProfileRepo ?? makeUserProfileRepo(),
    opts.notificationRepo ?? makeNotificationRepo(),
    opts.upcomingService ?? makeUpcomingService(),
    opts.emailService ?? makeEmailService(),
    opts.pushSubscriptionRepo ?? makePushSubscriptionRepo(),
    opts.webPushService ?? makeWebPushService(),
  );
}

describe('ReminderDigestService', () => {
  test('sends nothing when there are no eligible profiles or push subscriptions', async () => {
    const emailService = makeEmailService();
    const webPushService = makeWebPushService();
    const service = buildService({
      userProfileRepo: makeUserProfileRepo({ findAllEligibleForReminders: jest.fn().mockResolvedValue([]) }),
      emailService,
      webPushService,
    });

    const result = await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(webPushService.send).not.toHaveBeenCalled();
    expect(result).toEqual({
      usersChecked: 0,
      usersNotified: 0,
      emailsSent: 0,
      emailsFailed: 0,
      pushSent: 0,
      pushFailed: 0,
    });
  });

  test('skips a user with no upcoming reminders — no email or push sent', async () => {
    const emailService = makeEmailService();
    const service = buildService({ upcomingService: makeUpcomingService([]), emailService });

    const result = await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(result.usersNotified).toBe(0);
    expect(result.emailsSent).toBe(0);
  });

  test('sends one email per user with unsent reminders, reserving each key on the email channel', async () => {
    const notificationRepo = makeNotificationRepo();
    const emailService = makeEmailService();
    const items = [makeItem({ id: 'r1' }), makeItem({ id: 'r2', title: 'Fim da medicação' })];
    const service = buildService({ notificationRepo, upcomingService: makeUpcomingService(items), emailService });

    const result = await service.run();

    expect(notificationRepo.reserve).toHaveBeenCalledWith('user-001', 'custom:custom:r1', 'email');
    expect(notificationRepo.reserve).toHaveBeenCalledWith('user-001', 'custom:custom:r2', 'email');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('2'),
      expect.any(String),
    );
    expect(result.usersNotified).toBe(1);
    expect(result.emailsSent).toBe(1);
  });

  test('does not re-send an email whose reservation was already claimed', async () => {
    const notificationRepo = makeNotificationRepo({ reserve: jest.fn().mockResolvedValue(false) });
    const emailService = makeEmailService();
    const service = buildService({ notificationRepo, upcomingService: makeUpcomingService([makeItem()]), emailService });

    await service.run();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('releases the email reservation and does not count success when sending fails', async () => {
    const notificationRepo = makeNotificationRepo();
    const emailService = makeEmailService({ sendEmail: jest.fn().mockRejectedValue(new Error('SES down')) });
    const service = buildService({
      notificationRepo,
      upcomingService: makeUpcomingService([makeItem({ id: 'r1' })]),
      emailService,
    });

    const result = await service.run();

    expect(notificationRepo.release).toHaveBeenCalledWith('user-001', 'custom:custom:r1', 'email');
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
    const service = buildService({ userProfileRepo, upcomingService, emailService });

    const result = await service.run();

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith('ok@example.com', expect.any(String), expect.any(String));
    expect(result.usersChecked).toBe(2);
    expect(result.usersNotified).toBe(1);
  });

  test('digest email lists reminder titles and formatted dates', async () => {
    const emailService = makeEmailService();
    const service = buildService({
      upcomingService: makeUpcomingService([
        makeItem({ id: 'r1', title: 'Consulta com neuropediatra', dueAt: '2024-06-17T00:00:00.000Z' }),
      ]),
      emailService,
    });

    await service.run();

    const body = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
    expect(body).toContain('Consulta com neuropediatra');
    expect(body).toContain('17/06/2024');
  });

  test('sends push to every device a user has subscribed, reserving on the push channel', async () => {
    const notificationRepo = makeNotificationRepo();
    const webPushService = makeWebPushService();
    const subscriptions = [
      makeSubscription({ id: 'sub-a', endpoint: 'https://push.example.com/a' }),
      makeSubscription({ id: 'sub-b', endpoint: 'https://push.example.com/b' }),
    ];
    const service = buildService({
      userProfileRepo: makeUserProfileRepo({ findAllEligibleForReminders: jest.fn().mockResolvedValue([]) }),
      notificationRepo,
      pushSubscriptionRepo: makePushSubscriptionRepo({ findAll: jest.fn().mockResolvedValue(subscriptions) }),
      upcomingService: makeUpcomingService([makeItem({ id: 'r1' })]),
      webPushService,
    });

    const result = await service.run();

    expect(notificationRepo.reserve).toHaveBeenCalledWith('user-001', 'custom:custom:r1', 'push');
    expect(webPushService.send).toHaveBeenCalledTimes(2);
    expect(webPushService.send).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/a', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } },
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
    expect(result.pushSent).toBe(1);
    expect(result.usersNotified).toBe(1);
  });

  test('a user with both email and an active push subscription gets both, independently reserved', async () => {
    const reserveCalls: Array<[string, string, ReminderChannel]> = [];
    const notificationRepo = makeNotificationRepo({
      reserve: jest.fn((userId: string, key: string, channel: ReminderChannel) => {
        reserveCalls.push([userId, key, channel]);
        return Promise.resolve(true);
      }),
    });
    const emailService = makeEmailService();
    const webPushService = makeWebPushService();
    const service = buildService({
      notificationRepo,
      pushSubscriptionRepo: makePushSubscriptionRepo({ findAll: jest.fn().mockResolvedValue([makeSubscription()]) }),
      upcomingService: makeUpcomingService([makeItem({ id: 'r1' })]),
      emailService,
      webPushService,
    });

    const result = await service.run();

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(webPushService.send).toHaveBeenCalledTimes(1);
    expect(reserveCalls).toContainEqual(['user-001', 'custom:custom:r1', 'email']);
    expect(reserveCalls).toContainEqual(['user-001', 'custom:custom:r1', 'push']);
    expect(result.usersNotified).toBe(1);
  });

  test('deletes a subscription the push service reports as gone, without blocking other devices', async () => {
    const pushSubscriptionRepo = makePushSubscriptionRepo({
      findAll: jest.fn().mockResolvedValue([
        makeSubscription({ id: 'sub-gone', endpoint: 'https://push.example.com/gone' }),
        makeSubscription({ id: 'sub-live', endpoint: 'https://push.example.com/live' }),
      ]),
    });
    const webPushService = makeWebPushService({
      send: jest.fn((sub: { endpoint: string }) => {
        if (sub.endpoint === 'https://push.example.com/gone') return Promise.reject(new PushSubscriptionGoneError());
        return Promise.resolve(undefined);
      }),
    });
    const service = buildService({
      userProfileRepo: makeUserProfileRepo({ findAllEligibleForReminders: jest.fn().mockResolvedValue([]) }),
      pushSubscriptionRepo,
      upcomingService: makeUpcomingService([makeItem({ id: 'r1' })]),
      webPushService,
    });

    const result = await service.run();

    expect(pushSubscriptionRepo.deleteById).toHaveBeenCalledWith('sub-gone');
    expect(pushSubscriptionRepo.deleteById).not.toHaveBeenCalledWith('sub-live');
    expect(result.pushSent).toBe(1);
  });

  test('releases the push reservation for retry when every device fails to send', async () => {
    const notificationRepo = makeNotificationRepo();
    const webPushService = makeWebPushService({ send: jest.fn().mockRejectedValue(new Error('push service down')) });
    const service = buildService({
      userProfileRepo: makeUserProfileRepo({ findAllEligibleForReminders: jest.fn().mockResolvedValue([]) }),
      notificationRepo,
      pushSubscriptionRepo: makePushSubscriptionRepo({ findAll: jest.fn().mockResolvedValue([makeSubscription()]) }),
      upcomingService: makeUpcomingService([makeItem({ id: 'r1' })]),
      webPushService,
    });

    const result = await service.run();

    expect(notificationRepo.release).toHaveBeenCalledWith('user-001', 'custom:custom:r1', 'push');
    expect(result.pushSent).toBe(0);
    expect(result.pushFailed).toBe(1);
    expect(result.usersNotified).toBe(0);
  });
});
