import { Entity } from './Entity';

export interface UserProfileProps {
  userId: string;
  email: string | null;
  reminderEmailsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfile extends Entity<UserProfileProps, 'userId' | 'createdAt' | 'updatedAt'> {

  protected hiddenFields() {
    return ['userId', 'createdAt', 'updatedAt'] as const;
  }

  getUserId(): string { return this.props.userId; }
  getEmail(): string | null { return this.props.email; }
  isReminderEmailsEnabled(): boolean { return this.props.reminderEmailsEnabled; }

}
