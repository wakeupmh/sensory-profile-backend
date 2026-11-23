import { RequestHandler } from 'express';
import type { Pool } from 'pg';
import logger from '../../infrastructure/utils/logger';

/** Ready means the database answers; /health only says the process is alive. */
export function readinessHandler(pool: Pool): RequestHandler {
  return async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'READY', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.warn('Readiness check failed: database unreachable', { error });
      res.status(503).json({ status: 'UNAVAILABLE', timestamp: new Date().toISOString() });
    }
  };
}
