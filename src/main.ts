import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './shared/presentation/http-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get('APP_CONFIG') as {
    apiPrefix: string;
    port: number;
    corsOrigins: readonly string[];
    mfaEnabled: boolean;
    swaggerEnabled: boolean;
  };

  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false });
  app.use(json({ limit: '1mb' }));
  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Credible API')
      .setDescription('Credible financial operations API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document, {
      jsonDocumentUrl: `${config.apiPrefix}/docs-json`,
      swaggerOptions: { persistAuthorization: true },
    });
  }
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap();
