import { UserProfile } from '../../domain/entities/UserProfile';
import { UserProfileRepository } from '../../domain/repositories/UserProfileRepository';

export class NotificationPreferencesService {
  constructor(private readonly repo: UserProfileRepository) {}

  async get(userId: string): Promise<UserProfile> {
    const existing = await this.repo.findByUserId(userId);
    if (existing) return existing;
    // No profile yet (user hasn't been captured by authMiddleware's upsert
    // for some reason, e.g. their JWT never carried an email claim) —
    // return sensible defaults instead of a 404 for what is really just an
    // empty-but-valid preferences state.
    return new UserProfile({
      userId,
      email: null,
      reminderEmailsEnabled: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  setReminderEmailsEnabled(userId: string, enabled: boolean): Promise<UserProfile> {
    return this.repo.setReminderEmailsEnabled(userId, enabled);
  }
}
