import { SchoolCommunication, SchoolCommunicationSummary, SchoolCommType } from '../entities/SchoolCommunication';
export type { SchoolCommunicationSummary };

export interface SchoolCommunicationCreateInput {
  id: string;
  userId: string;
  childId: string;
  occurredAt: Date;
  commType: SchoolCommType;
  subject: string;
  description?: string | null;
  attendees?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface SchoolCommunicationUpdateInput {
  occurredAt?: Date;
  commType?: SchoolCommType;
  subject?: string;
  description?: string | null;
  attendees?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface SchoolCommunicationFilters {
  childId?: string;
  commType?: SchoolCommType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface SchoolCommunicationRepository {
  save(input: SchoolCommunicationCreateInput): Promise<SchoolCommunication>;
  findById(id: string, userId: string): Promise<SchoolCommunication | null>;
  findAllByUser(
    userId: string,
    filters: SchoolCommunicationFilters,
  ): Promise<{ data: SchoolCommunicationSummary[]; total: number; page: number; limit: number }>;
  update(id: string, userId: string, input: SchoolCommunicationUpdateInput): Promise<SchoolCommunication | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
