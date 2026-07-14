import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.use(helmet());
  // Do NOT compress SSE — it buffers the stream. Skip text/event-stream.
  app.use(
    compression({
      filter: (req, res) =>
        res.getHeader('Content-Type') !== 'text/event-stream' &&
        compression.filter(req, res),
    }),
  );
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('GenXTaxi chat-orchestrator')
    .setDescription('AI chatbot: tool-calling loop, RAG grounding, confirmation cards, SSE, escalation (spec §2).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT ? Number(process.env.PORT) : 8082;
  await app.listen(port);
}
bootstrap();
