import { UserProfile } from '../entities/UserProfile';

export interface UserProfileRepository {
  /** Creates the row if missing, or updates `email` if it changed. Never touches reminder_emails_enabled. */
  upsertEmail(userId: string, email: string | null): Promise<void>;
  findByUserId(userId: string): Promise<UserProfile | null>;
  setReminderEmailsEnabled(userId: string, enabled: boolean): Promise<UserProfile>;
  /** Every profile with a known email and reminder emails enabled. */
  findAllEligibleForReminders(): Promise<UserProfile[]>;
}
