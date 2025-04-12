import { Assessment } from '../entities/Assessment';

export interface AssessmentRepository {
  findAll(userId: string): Promise<Assessment[]>;
  findById(id: string, userId: string): Promise<Assessment | null>;
  save(assessment: Assessment, userId: string): Promise<Assessment>;
  update(assessment: Assessment, userId: string): Promise<Assessment>;
  delete(id: string, userId: string): Promise<void>;
  findByChildId(childId: string, userId: string): Promise<Assessment[]>;
}
