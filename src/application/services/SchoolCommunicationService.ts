import { SchoolCommunication, SchoolCommType } from '../../domain/entities/SchoolCommunication';
import {
  SchoolCommunicationRepository,
  SchoolCommunicationCreateInput,
  SchoolCommunicationUpdateInput,
  SchoolCommunicationFilters,
} from '../../domain/repositories/SchoolCommunicationRepository';
import { BaseDomainService } from './BaseDomainService';

export interface CreateSchoolCommunicationPayload {
  childId: string;
  occurredAt: string;
  commType: SchoolCommType;
  subject: string;
  description?: string | null;
  attendees?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface UpdateSchoolCommunicationPayload {
  occurredAt?: string;
  commType?: SchoolCommType;
  subject?: string;
  description?: string | null;
  attendees?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export class SchoolCommunicationService extends BaseDomainService<
  SchoolCommunication,
  SchoolCommunicationCreateInput,
  SchoolCommunicationUpdateInput,
  CreateSchoolCommunicationPayload,
  UpdateSchoolCommunicationPayload,
  SchoolCommunicationFilters
> {
  constructor(repo: SchoolCommunicationRepository) {
    super(repo, 'Comunicação escolar não encontrada');
  }

  // Override: convert occurredAt string → Date before saving
  create(payload: CreateSchoolCommunicationPayload, userId: string): Promise<SchoolCommunication> {
    return super.create({
      ...payload,
      occurredAt: new Date(payload.occurredAt),
    } as unknown as CreateSchoolCommunicationPayload, userId);
  }

  // Override: convert occurredAt string → Date before updating
  async update(id: string, payload: UpdateSchoolCommunicationPayload, userId: string): Promise<SchoolCommunication> {
    return super.update(id, {
      ...payload,
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
    } as unknown as UpdateSchoolCommunicationPayload, userId);
  }
}
