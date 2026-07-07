import { Document } from '../entities/Document';

export interface DocumentCreateInput {
  id: string;
  userId: string;
  childId: string;
  title: string;
  description?: string | null;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  expiresAt?: Date | null;
}

export interface DocumentUpdateInput {
  title?: string;
  description?: string | null;
  expiresAt?: Date | null;
}

export interface DocumentFilters {
  childId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface DocumentRepository {
  save(input: DocumentCreateInput): Promise<Document>;
  findById(id: string, userId: string): Promise<Document | null>;
  findAllByUser(userId: string, filters: DocumentFilters): Promise<Document[]>;
  update(id: string, userId: string, input: DocumentUpdateInput): Promise<Document | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
