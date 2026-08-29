import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Banner images uploaded through the events wizard are written to
  // <backend>/uploads and served back out from here at /uploads/... —
  // this path is intentionally OUTSIDE the /api prefix set below.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const frontendOrigins = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = frontendOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin);
      callback(null, isAllowed);
    },
    credentials: true,
  });

  const port = config.get<number>('PORT') || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Pulseframe API running on http://localhost:${port}/api`);
}

bootstrap();
