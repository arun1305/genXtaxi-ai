import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppError, ErrorCode } from '@genxtaxi/ai-shared';
import { Response } from 'express';

/** Maps domain AppError + Nest HttpException to a consistent JSON envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private static readonly CODE_STATUS: Record<ErrorCode, number> = {
    [ErrorCode.VALIDATION]: HttpStatus.BAD_REQUEST,
    [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
    [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
    [ErrorCode.BUDGET_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
    [ErrorCode.PROVIDER_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
    [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
    [ErrorCode.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
  };

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    // SSE responses have already sent headers; nothing to serialize here.
    if (res.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL;
    let message = 'Internal server error';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      status = AllExceptionsFilter.CODE_STATUS[exception.code];
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>).message as string) ?? exception.message;
      code = HttpStatus[status] ?? ErrorCode.INTERNAL;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) this.logger.error(message, (exception as Error)?.stack);
    res.status(status).json({ error: { code, message, details } });
  }
}
