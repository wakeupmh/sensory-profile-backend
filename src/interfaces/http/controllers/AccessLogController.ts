import { Request, Response } from 'express';
import { AccessLogService } from '../../../application/services/AccessLogService';
import { listAccessLogsQuerySchema } from '../validations/professionalNoteValidation';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import { assertValidId, requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class AccessLogController {
  constructor(private readonly service: AccessLogService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const { childId } = req.params;
    assertValidId(childId, 'child ID');
    const userId = requireUserId(req);
    const { page, limit } = listAccessLogsQuerySchema.parse(req.query);
    const result = await this.service.listForChild(childId, userId, page, limit);
    jsonResponse(res, result.data.map((l) => l.toJSON()), 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      count: result.data.length,
    });
  });
}
