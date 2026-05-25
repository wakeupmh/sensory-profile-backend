import { Response } from 'express';

export function jsonResponse<T>(res: Response, data: T, statusCode = 200, meta?: Record<string, unknown>) {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ?? {}),
    timestamp: new Date().toISOString(),
  });
}

export function jsonMessage(res: Response, message: string, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
  });
}
