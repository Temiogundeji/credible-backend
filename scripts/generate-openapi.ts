import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const appConfig = app.get('APP_CONFIG') as { apiPrefix: string };
  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const config = new DocumentBuilder()
    .setTitle('Credible API')
    .setDescription('Credible financial operations API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.cwd(), '..', 'docs', 'contracts', 'api', 'openapi.json');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  process.stdout.write(`OpenAPI document written to ${outputPath}\n`);
}

void generateOpenApi().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
