import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}. Check backend/.env or deployment variables.`);
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const corsOrigins = frontendUrl.includes(',') ? frontendUrl.split(',').map((o) => o.trim()) : [frontendUrl];
  // Always allow Vercel deployment (in case FRONTEND_URL not set in Railway)
  const vercelOrigin = 'https://vybe-mvp.vercel.app';
  if (!corsOrigins.includes(vercelOrigin)) corsOrigins.push(vercelOrigin);
  app.enableCors({ origin: corsOrigins, credentials: true });
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Vybe API running at http://localhost:${port}/api/v1`);
}
bootstrap();
