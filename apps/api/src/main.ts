import { LogLevel, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorTrackingService } from './common/error-tracking.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validateRuntimeEnvironment } from './config/env.validation';

type RequestWithId = Request & {
  requestId?: string;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: resolveLoggerLevels(process.env.LOG_LEVEL) });
  const config = app.get(ConfigService);
  const errorTracking = app.get(ErrorTrackingService);
  validateRuntimeEnvironment(config);

  app.use(helmet());
  app.use((request: RequestWithId, response: Response, next: NextFunction) => {
    const requestId = String(request.headers['x-request-id'] ?? randomUUID());
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.enableCors({
    origin: config.get<string>('APP_ORIGIN') ?? '*',
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(config, errorTracking));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Malta Craftsman Marketplace API')
    .setDescription('Mobile marketplace REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT') ?? config.get<number>('API_PORT') ?? 3000;
  await app.listen(port);
}

void bootstrap();

function resolveLoggerLevels(level: string | undefined): LogLevel[] {
  switch (level) {
    case 'error':
      return ['error'];
    case 'warn':
      return ['error', 'warn'];
    case 'debug':
      return ['error', 'warn', 'log', 'debug'];
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    case 'info':
    default:
      return ['error', 'warn', 'log'];
  }
}
