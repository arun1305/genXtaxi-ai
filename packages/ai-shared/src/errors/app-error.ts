/**
 * Transport-agnostic domain errors. NestJS filters map these to HTTP status
 * codes so business logic never imports HTTP concerns directly (SOLID / clean
 * architecture).
 */
export enum ErrorCode {
  VALIDATION = 'VALIDATION',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BudgetExceededError extends AppError {
  constructor(userId: string, limit: number) {
    super(ErrorCode.BUDGET_EXCEEDED, `Daily token budget exceeded for user`, {
      userId,
      limit,
    });
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(provider: string, cause?: string) {
    super(
      ErrorCode.PROVIDER_UNAVAILABLE,
      `AI provider "${provider}" is unavailable`,
      { provider, cause },
    );
  }
}
