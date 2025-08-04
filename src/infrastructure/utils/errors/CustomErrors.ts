export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

// 400 Bad Request Errors
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, public readonly details?: any, cause?: Error) {
    super(message, cause);
  }
}

export class InvalidInputError extends BaseError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, public readonly field?: string, cause?: Error) {
    super(message, cause);
  }
}

export class ScoringError extends BaseError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, public readonly invalidItems?: string[], cause?: Error) {
    super(message, cause);
  }
}

// 401 Unauthorized Errors
export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', cause?: Error) {
    super(message, cause);
  }
}

// 403 Forbidden Errors
export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(message: string = 'Access denied', public readonly requiredPermission?: string, cause?: Error) {
    super(message, cause);
  }
}

// 404 Not Found Errors
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(resource: string, identifier?: string, cause?: Error) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, cause);
  }
}

export class AssessmentNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Assessment', id, cause);
  }
}

export class ChildNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Child', id, cause);
  }
}

// 409 Conflict Errors
export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly isOperational = true;

  constructor(message: string, public readonly conflictingResource?: string, cause?: Error) {
    super(message, cause);
  }
}

export class DuplicateResourceError extends ConflictError {
  constructor(resource: string, identifier: string, cause?: Error) {
    super(`${resource} with identifier '${identifier}' already exists`, resource, cause);
  }
}

// 422 Unprocessable Entity Errors
export class BusinessLogicError extends BaseError {
  readonly statusCode = 422;
  readonly isOperational = true;

  constructor(message: string, public readonly businessRule?: string, cause?: Error) {
    super(message, cause);
  }
}

export class DataConsistencyError extends BusinessLogicError {
  constructor(
    message: string, 
    public readonly inconsistentField?: string, 
    public readonly expectedValue?: any, 
    public readonly actualValue?: any, 
    cause?: Error
  ) {
    super(message, 'data_consistency', cause);
  }
}

// 500 Internal Server Errors
export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(message: string = 'Internal server error', cause?: Error) {
    super(message, cause);
  }
}

export class DatabaseError extends InternalServerError {
  constructor(
    message: string, 
    public readonly operation?: string, 
    public readonly table?: string, 
    cause?: Error
  ) {
    super(message, cause);
  }
}

export class ExternalServiceError extends InternalServerError {
  constructor(
    message: string, 
    public readonly service?: string, 
    public readonly externalStatusCode?: number, 
    cause?: Error
  ) {
    super(message, cause);
  }
}

// 503 Service Unavailable Errors
export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string, public readonly service?: string, cause?: Error) {
    super(message, cause);
  }
}

// Error factory functions
export const createValidationError = (message: string, details?: any): ValidationError => {
  return new ValidationError(message, details);
};

export const createNotFoundError = (resource: string, id?: string): NotFoundError => {
  return new NotFoundError(resource, id);
};

export const createDatabaseError = (message: string, operation?: string, table?: string, cause?: Error): DatabaseError => {
  return new DatabaseError(message, operation, table, cause);
};

export const createScoringError = (message: string, invalidItems?: string[]): ScoringError => {
  return new ScoringError(message, invalidItems);
};

// Type guards
export const isOperationalError = (error: Error): error is BaseError => {
  return error instanceof BaseError && error.isOperational;
};

export const isValidationError = (error: Error): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isNotFoundError = (error: Error): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isDatabaseError = (error: Error): error is DatabaseError => {
  return error instanceof DatabaseError;
};

export const isAuthenticationError = (error: Error): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isAuthorizationError = (error: Error): error is AuthorizationError => {
  return error instanceof AuthorizationError;
};

// Error serialization for logging and API responses
export const serializeError = (error: Error) => {
  const baseInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  if (error instanceof BaseError) {
    return {
      ...baseInfo,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      ...(error instanceof ValidationError && { details: error.details }),
      ...(error instanceof InvalidInputError && { field: error.field }),
      ...(error instanceof ScoringError && { invalidItems: error.invalidItems }),
      ...(error instanceof AuthorizationError && { requiredPermission: error.requiredPermission }),
      ...(error instanceof ConflictError && { conflictingResource: error.conflictingResource }),
      ...(error instanceof BusinessLogicError && { businessRule: error.businessRule }),
      ...(error instanceof DataConsistencyError && {
        inconsistentField: error.inconsistentField,
        expectedValue: error.expectedValue,
        actualValue: error.actualValue
      }),
      ...(error instanceof DatabaseError && {
        operation: error.operation,
        table: error.table
      }),
      ...(error instanceof ExternalServiceError && {
        service: error.service,
        externalStatusCode: error.externalStatusCode
      }),
      ...(error instanceof ServiceUnavailableError && { service: error.service })
    };
  }

  return baseInfo;
};