import { Response } from '../entities/Response';

export interface ResponseRepository {
  findByAssessmentId(assessmentId: string, userId?: string): Promise<Response[]>;
  save(response: Response, userId: string): Promise<Response>;
  saveMany(responses: Response[], userId: string): Promise<Response[]>;
  update(response: Response, userId: string): Promise<Response>;
  delete(id: string, userId: string): Promise<void>;
  deleteByAssessmentId(assessmentId: string, userId: string): Promise<void>;
}
