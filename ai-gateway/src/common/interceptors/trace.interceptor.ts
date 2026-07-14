import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stamps every request with a traceId (spec §1 Observability: every AI call
 * logs traceId). Honors an inbound x-trace-id so a trace can span services.
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    return next.handle();
  }
}
