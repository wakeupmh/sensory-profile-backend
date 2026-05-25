import { Response } from 'express';

export function jsonResponse<T>(res: Response, data: T, statusCode = 200, meta?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  if (meta) {
    Object.entries(meta).forEach(([key, value]) => {
      if (key !== 'success' && key !== 'data' && key !== 'timestamp') {
        payload[key] = value;
      }
    });
  }
  res.status(statusCode).json(payload);
}

export function jsonMessage(res: Response, message: string, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    timestamp: new Date().toISOString(),
  });
}
