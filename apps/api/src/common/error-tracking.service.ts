import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly dsn?: string;

  constructor(config: ConfigService) {
    this.dsn = config.get<string>('SENTRY_DSN')?.trim() || undefined;

    if (this.dsn) {
      this.logger.log('Sentry DSN configured. Error capture hook is active.');
    }
  }

  captureException(error: unknown, context: Record<string, unknown>) {
    if (!this.dsn) {
      return;
    }

    this.logger.error(
      JSON.stringify({
        event: 'error_tracking_capture',
        context,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      }),
    );
  }
}
