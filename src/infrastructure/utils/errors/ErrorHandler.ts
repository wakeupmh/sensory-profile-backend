import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  ConflictError,
  BaseError,
  ValidationError,
  InternalServerError,
  serializeError
} from './CustomErrors';
import logger from '../logger';

// Convert Zod errors to ValidationError
const handleZodError = (error: ZodError): ValidationError => {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: 'received' in err ? err.received : undefined
  }));

  const message = `Validation failed: ${details.map(d => `${d.field}: ${d.message}`).join(', ')}`;
  return new ValidationError(message, details);
};

/**
 * Erros do node-postgres carregam o SQLSTATE em `.code` (cinco caracteres).
 * Detectar por aí, e não pelo nome da classe: o `name` que o driver define é
 * só `'error'`, e a checagem anterior comparava com `QueryFailedError`, que é
 * o nome do TypeORM — um ORM que este projeto não usa. Na prática o mapeador
 * nunca executou, e toda violação de constraint virava 500 (com alerta) em
 * vez do 4xx que ela é.
 */
function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

const handleDatabaseError = (error: Error): BaseError => {
  switch (pgErrorCode(error)) {
    case '23505': // unique_violation
      return new ConflictError('Este registro já existe');
    case '23503': // foreign_key_violation
      return new ValidationError('Referenced resource does not exist', { originalError: error.message });
    case '23502': // not_null_violation
      return new ValidationError('Required field is missing', { originalError: error.message });
    case '23514': // check_violation
      return new ValidationError('Valor fora do permitido para este campo', { originalError: error.message });
    case '22P02': // invalid_text_representation (ex.: uuid malformado)
      return new ValidationError('Formato de valor inválido', { originalError: error.message });
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return new ConflictError('Conflito de concorrência, tente novamente');
    default:
      return new InternalServerError('Database operation failed', error);
  }
};

// Main error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  // Não usado, mas obrigatório: o Express identifica um error handler pela
  // aridade 4 da função. Removê-lo faria este handler deixar de ser chamado.
  _next: NextFunction
): void => {
  let customError: BaseError;

  // Convert known error types to custom errors
  if (error instanceof BaseError) {
    customError = error;
  } else if (error instanceof ZodError) {
    customError = handleZodError(error);
  } else if (pgErrorCode(error) !== undefined) {
    customError = handleDatabaseError(error);
  } else {
    // Unknown error - treat as internal server error
    customError = new InternalServerError('An unexpected error occurred', error);
  }

  // Log the error with appropriate level
  const errorInfo = serializeError(customError);
  const logContext = {
    requestId: req.headers['x-request-id'] || 'unknown',
    userId: (req as any).userId || 'anonymous',
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    error: errorInfo
  };

  if (customError.isOperational) {
    logger.warn('Operational error occurred', logContext);
  } else {
    logger.error('System error occurred', logContext);
  }

  // Prepare response
  const response: any = {
    success: false,
    error: {
      type: customError.name,
      message: customError.message,
      statusCode: customError.statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details for development environment
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = customError.stack;
    
    // Add specific error details
    if (customError instanceof ValidationError && customError.details) {
      response.error.details = customError.details;
    }
  }

  // Add request ID for tracking
  if (req.headers['x-request-id']) {
    response.error.requestId = req.headers['x-request-id'];
  }

  res.status(customError.statusCode).json(response);
};

// Async error wrapper for route handlers
export const asyncHandler = <T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) => {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.method} ${req.path} not found`;
  
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(404).json({
    success: false,
    error: {
      type: 'NotFoundError',
      message,
      statusCode: 404,
      timestamp: new Date().toISOString()
    }
  });
};

// Graceful shutdown handler
export const setupGracefulShutdown = (server?: import('http').Server): void => {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000);
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { error: serializeError(error) });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Promise Rejection', { error: serializeError(error) });
    process.exit(1);
  });
};

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || `req-${randomBytes(8).toString('hex')}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Request started', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};