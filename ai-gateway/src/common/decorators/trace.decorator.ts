import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Injects the per-request traceId stamped by TraceInterceptor (spec §1 obs). */
export const TraceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().traceId,
);
