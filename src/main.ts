import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { securityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  // Global API prefix & versioning (API Spec §4–§5)
  app.setGlobalPrefix('api/v1');

  // Request id / correlation id on every request
  app.use(requestIdMiddleware);

  // Baseline security headers + hide the framework (Security Spec §22).
  app.use(securityHeadersMiddleware);
  // Do not advertise the web framework.
  (app.getHttpAdapter().getInstance() as { disable?: (k: string) => void }).disable?.('x-powered-by');

  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`bilokat-api listening on http://0.0.0.0:${port} (${config.get<string>('env')})`, 'Bootstrap');
}

void bootstrap();
