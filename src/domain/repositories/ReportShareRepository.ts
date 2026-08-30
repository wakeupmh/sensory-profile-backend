import { ReportShare } from '../entities/ReportShare';

export interface ReportShareRepository {
  create(share: ReportShare): Promise<void>;
  findByToken(token: string): Promise<ReportShare | null>;
  findByUserAndChild(userId: string, childId: string): Promise<ReportShare[]>;
  findById(id: string, userId: string): Promise<ReportShare | null>;
  deleteById(id: string, userId: string): Promise<void>;
}
