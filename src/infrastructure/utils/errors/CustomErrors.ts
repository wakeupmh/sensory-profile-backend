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
/** Corpo que o express não conseguiu ler: JSON inválido (400), grande demais (413) etc. */
export class RequestBodyError extends BaseError {
  readonly isOperational = true;

  constructor(readonly statusCode: number, cause: Error) {
    super(statusCode === 413 ? 'Corpo da requisição grande demais.' : 'Corpo da requisição inválido.', cause);
  }
}

export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, public readonly details?: any, cause?: Error) {
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

  constructor(message: string = 'Autenticação necessária', cause?: Error) {
    super(message, cause);
  }
}

// 403 Forbidden Errors
export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(message: string = 'Acesso negado', public readonly requiredPermission?: string, cause?: Error) {
    super(message, cause);
  }
}

// 404 Not Found Errors
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(resource: string, identifier?: string, cause?: Error) {
    // Vários chamadores já passam o rótulo pronto ("Lembrete não encontrado");
    // não duplicar o "não encontrado".
    const base = /não encontrad[oa]/i.test(resource)
      ? resource
      : `${resource} não encontrado(a)`;
    super(identifier ? `${base} (${identifier})` : base, cause);
  }
}

export class AssessmentNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Avaliação', id, cause);
  }
}

export class ChildNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Criança', id, cause);
  }
}

export class AnamneseNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Anamnese', id, cause);
  }
}

// 410 Gone Errors
export class GoneError extends BaseError {
  readonly statusCode = 410;
  readonly isOperational = true;

  constructor(message: string = 'Este recurso não está mais disponível', cause?: Error) {
    super(message, cause);
  }
}

export class ProfessionalNotFoundError extends NotFoundError {
  constructor(id: string, cause?: Error) {
    super('Profissional', id, cause);
  }
}

export class InvitationInvalidError extends ValidationError {
  constructor(message: string = 'O convite é inválido ou já foi utilizado', cause?: Error) {
    super(message, undefined, cause);
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

// 500 Internal Server Errors
export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(message: string = 'Erro interno do servidor', cause?: Error) {
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
      ...(error instanceof ScoringError && { invalidItems: error.invalidItems }),
      ...(error instanceof AuthorizationError && { requiredPermission: error.requiredPermission }),
      ...(error instanceof ConflictError && { conflictingResource: error.conflictingResource }),
      ...(error instanceof ServiceUnavailableError && { service: error.service })
    };
  }

  return baseInfo;
};