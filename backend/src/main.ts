import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));
  app.use(express.raw({ type: 'image/*', limit: '5mb' }));

  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*', allowedHeaders: 'Content-Type,X-Device-Token' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Triaje NestJS backend en :${port}`);
}
bootstrap();
