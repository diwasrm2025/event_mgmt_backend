import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { extended: true });
  const config = app.get(ConfigService);

  // Keep serving older local media URLs; all new uploads use Cloudinary.
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
  console.log(`SRM Trichy API running on http://localhost:${port}/api`);
}

bootstrap();
