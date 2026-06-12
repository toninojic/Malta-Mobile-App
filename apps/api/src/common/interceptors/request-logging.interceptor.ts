import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';

type RequestWithContext = Request & {
  requestId?: string;
  user?: { id?: string };
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logRequest(request, response.statusCode, Date.now() - startedAt);
      }),
      catchError((error: unknown) => {
        this.logRequest(request, statusFromError(error), Date.now() - startedAt);
        return throwError(() => error);
      }),
    );
  }

  private logRequest(request: RequestWithContext, statusCode: number, durationMs: number) {
    this.logger.log(
      JSON.stringify({
        requestId: request.requestId ?? request.headers['x-request-id'],
        method: request.method,
        path: request.originalUrl ?? request.url,
        status: statusCode,
        durationMs,
        userId: request.user?.id,
      }),
    );
  }
}

function statusFromError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'getStatus' in error && typeof error.getStatus === 'function') {
    return error.getStatus();
  }

  return 500;
}
