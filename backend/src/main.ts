import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}. Check backend/.env or deployment variables.`);
  }

  const uploadsRoot = join(process.cwd(), 'uploads');
  const uploadsProducts = join(uploadsRoot, 'products');
  if (!existsSync(uploadsProducts)) {
    mkdirSync(uploadsProducts, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads/' });
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
  const corsOrigins = frontendUrl.includes(',')
    ? frontendUrl.split(',').map((o) => o.trim()).filter(Boolean)
    : [frontendUrl];
  const vercelProd = 'https://vybe-mvp.vercel.app';
  if (!corsOrigins.includes(vercelProd)) corsOrigins.push(vercelProd);

  const isHttpsVercelApp = (origin: string) => {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      // curl, Postman, same-origin server-side — no Origin header
      if (!origin) {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        return callback(null, origin);
      }
      // Any *.vercel.app (production + preview, e.g. project-xxx-team.vercel.app)
      if (isHttpsVercelApp(origin)) {
        return callback(null, origin);
      }
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, origin);
      }
      callback(null, false);
    },
    credentials: true,
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Vibe Super App API at http://0.0.0.0:${port}/api/v1`);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
