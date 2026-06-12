import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ErrorTrackingService } from '../error-tracking.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    private readonly config?: ConfigService,
    private readonly errorTracking?: ErrorTrackingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{
      method: string;
      url: string;
      requestId?: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { id?: string };
    }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException || status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId: request.requestId ?? request.headers['x-request-id'],
          status,
          method: request.method,
          path: request.url,
          userId: request.user?.id,
          error: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : String(exception),
        }),
      );
      this.errorTracking?.captureException(exception, {
        requestId: request.requestId ?? request.headers['x-request-id'],
        status,
        method: request.method,
        path: request.url,
        userId: request.user?.id,
      });
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS && this.config?.get<string>('NODE_ENV') !== 'production') {
      this.logger.warn({
        status,
        method: request.method,
        path: request.url,
        userId: request.user?.id,
      });
    }

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : { message: exceptionResponse ?? 'Internal server error' };

    response.status(status).json({
      statusCode: status,
      requestId: request.requestId ?? request.headers['x-request-id'],
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...message,
    });
  }
}
