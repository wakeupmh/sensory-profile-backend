export interface UserProfileProps {
  userId: string;
  email: string | null;
  reminderEmailsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfile {
  constructor(private readonly props: UserProfileProps) {}

  getUserId(): string { return this.props.userId; }
  getEmail(): string | null { return this.props.email; }
  isReminderEmailsEnabled(): boolean { return this.props.reminderEmailsEnabled; }

  toJSON() {
    return {
      email: this.props.email,
      reminderEmailsEnabled: this.props.reminderEmailsEnabled,
    };
  }
}
