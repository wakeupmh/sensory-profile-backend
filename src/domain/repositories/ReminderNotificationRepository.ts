export type ReminderChannel = 'email' | 'push';

export interface ReminderNotificationRepository {
  /**
   * Atomically reserves the (userId, reminderKey, channel) triple. Returns
   * true if this call won the reservation (no notification was sent before
   * on this channel), false if another run already claimed it — the caller
   * must not send a duplicate notification in that case. Channel-scoped so
   * email and push track independently: a user with both enabled should get
   * both, not whichever channel's digest pass ran first.
   */
  reserve(userId: string, reminderKey: string, channel: ReminderChannel): Promise<boolean>;

  /** Releases a reservation so the reminder is retried on the next run — used when sending fails after reserving. */
  release(userId: string, reminderKey: string, channel: ReminderChannel): Promise<void>;
}
