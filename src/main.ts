import './observability/otel';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { shutdownOtel } from './observability/otel';
import { GatewayConfig } from './config/config.types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const config = configService.get<GatewayConfig>('gateway');

  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: config?.allowedOrigins || ['http://localhost:3002'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'apollo-require-preflight',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const port = config?.port || 3000;
  await app.listen(port);

  const gracefulShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await shutdownOtel();
    await app.close();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
bootstrap();
