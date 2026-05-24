import { v7 as uuidv7 } from 'uuid';
import { SchoolCommunication, SchoolCommType } from '../../domain/entities/SchoolCommunication';
import {
  SchoolCommunicationRepository,
  SchoolCommunicationFilters,
  SchoolCommunicationSummary,
} from '../../domain/repositories/SchoolCommunicationRepository';
import { NotFoundError } from '../../infrastructure/utils/errors/CustomErrors';

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

export class SchoolCommunicationService {
  constructor(private readonly repo: SchoolCommunicationRepository) {}

  list(
    userId: string,
    filters: SchoolCommunicationFilters,
  ): Promise<{ data: SchoolCommunicationSummary[]; total: number; page: number; limit: number }> {
    return this.repo.findAllByUser(userId, filters);
  }

  async getById(id: string, userId: string): Promise<SchoolCommunication> {
    const comm = await this.repo.findById(id, userId);
    if (!comm) throw new NotFoundError('Comunicação escolar não encontrada', id);
    return comm;
  }

  create(payload: CreateSchoolCommunicationPayload, userId: string): Promise<SchoolCommunication> {
    return this.repo.save({
      id: uuidv7(),
      userId,
      ...payload,
      occurredAt: new Date(payload.occurredAt),
    });
  }

  async update(id: string, payload: UpdateSchoolCommunicationPayload, userId: string): Promise<SchoolCommunication> {
    const updated = await this.repo.update(id, userId, {
      ...payload,
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
    });
    if (!updated) throw new NotFoundError('Comunicação escolar não encontrada', id);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new NotFoundError('Comunicação escolar não encontrada', id);
  }
}
