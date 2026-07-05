export interface ReminderNotificationRepository {
  /**
   * Atomically reserves the (userId, reminderKey) pair. Returns true if this
   * call won the reservation (no notification was sent before), false if
   * another run already claimed it — the caller must not send a duplicate
   * email in that case.
   */
  reserve(userId: string, reminderKey: string): Promise<boolean>;

  /** Releases a reservation so the reminder is retried on the next run — used when sending the email fails after reserving. */
  release(userId: string, reminderKey: string): Promise<void>;
}
