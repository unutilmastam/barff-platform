import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './common/config/app-config.service.js';
import { StructuredLogger } from './common/logger/structured-logger.service.js';
import { configureApp, docsPath, setupSwagger } from './bootstrap.js';

async function bootstrap(): Promise<void> {
  // The logger is constructed before the app so configuration failures are
  // reported in the same JSON format as everything else. LOG_LEVEL is read
  // directly here only because the container that would provide it does not
  // exist yet.
  const bootLogger = new StructuredLogger(
    (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error' | undefined) ?? 'info',
    'Bootstrap',
  );

  const app = await NestFactory.create(AppModule, { logger: bootLogger, bufferLogs: false });
  const config = app.get(AppConfigService);

  configureApp(app, config);
  const docsEnabled = setupSwagger(app, config);

  await app.listen(config.port, config.host);

  bootLogger.log('API started', {
    port: config.port,
    host: config.host,
    environment: config.nodeEnv,
    docs: docsEnabled ? `/${docsPath(config)}` : 'disabled in production',
    corsOrigins: config.corsAllowedOrigins.length,
  });
}

void bootstrap().catch((error: unknown) => {
  // Nothing is running yet, so there is no logger to route this through.
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'API failed to start',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    })}\n`,
  );
  process.exit(1);
});
