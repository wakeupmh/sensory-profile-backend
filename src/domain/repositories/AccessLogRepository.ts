import { AccessLog, AccessLogAction } from '../entities/AccessLog';

export interface AccessLogCreateInput {
  actorUserId: string;
  professionalId?: string | null;
  childId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: AccessLogAction;
}

export interface AccessLogListResult {
  data: AccessLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AccessLogRepository {
  record(input: AccessLogCreateInput): Promise<void>;
  listForChild(childId: string, page: number, limit: number): Promise<AccessLogListResult>;
}
