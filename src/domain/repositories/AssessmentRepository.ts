import { Assessment } from '../entities/Assessment';

export interface AssessmentWithRelations extends Assessment {
  childName?: string;
  childBirthDate?: Date;
  childGender?: string;
  childOtherInfo?: string;
  childAge?: number;
  examinerName?: string;
  examinerProfession?: string;
  examinerContact?: string;
  caregiverName?: string;
  caregiverRelationship?: string;
  caregiverContact?: string;
}

export interface AssessmentQueryOptions {
  page?: number;
  limit?: number;
  childId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AssessmentRepository {
  findAll(userId: string, options?: AssessmentQueryOptions): Promise<PaginatedResult<Assessment>>;
  findById(id: string, userId: string): Promise<Assessment | null>;
  save(assessment: Assessment, userId: string): Promise<Assessment>;
  update(assessment: Assessment, userId: string): Promise<Assessment>;
  delete(id: string, userId: string): Promise<void>;
  findByChildId(childId: string, userId: string, page?: number, limit?: number): Promise<AssessmentWithRelations[]>;
}
