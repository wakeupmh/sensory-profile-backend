import { Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/utils/errors/ErrorHandler';
import logger from '../../../infrastructure/utils/logger';
import { SearchService } from '../../../application/services/SearchService';
import { searchQuerySchema } from '../validations/searchValidation';
import { requireUserId } from './controllerUtils';
import { jsonResponse } from '../utils/response';

export class SearchController {
  constructor(private readonly service: SearchService) {}

  search = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { q } = searchQuerySchema.parse(req.query);
    logger.info(`[search] userId=${userId} q.length=${q.length}`);
    const results = await this.service.search(userId, q);
    jsonResponse(res, results);
  });
}
