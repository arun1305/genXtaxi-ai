import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('GenXTaxi chat-orchestrator')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  writeFileSync('openapi.json', JSON.stringify(SwaggerModule.createDocument(app, config), null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log('Wrote chat-orchestrator/openapi.json');
}
generate();
