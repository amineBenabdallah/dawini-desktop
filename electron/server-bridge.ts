import { app } from 'electron';
import * as path from 'path';

/**
 * Bridge between Electron main process and the embedded NestJS server.
 */

let nestApp: any = null;

// Resolve Angular dist path (from project root, not dist/electron/)
const ANGULAR_PATH = path.join(__dirname, '..', '..', 'app', 'dist', 'cabinet-medical', 'browser');

export async function startServer(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'dawini.db');
  process.env.DB_PATH = dbPath;
  process.env.PORT = process.env.PORT || '3333';
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.FRONTEND_URL = 'http://localhost:3333';
  process.env.ANGULAR_PATH = ANGULAR_PATH;

  if (!process.env.JWT_SECRET) {
    const fs = require('fs');
    const crypto = require('crypto');
    const secretPath = path.join(app.getPath('userData'), 'jwt-secret.txt');
    let secret: string;
    try {
      secret = fs.readFileSync(secretPath, 'utf-8').trim();
    } catch {
      secret = crypto.randomBytes(32).toString('hex');
      const dir = path.dirname(secretPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(secretPath, secret);
    }
    process.env.JWT_SECRET = secret;
  }

  const { NestFactory, Reflector } = require('@nestjs/core');
  const { ValidationPipe, ClassSerializerInterceptor } = require('@nestjs/common');
  const helmet = require('helmet');
  const express = require('express');

  const modulePath = path.join(__dirname, '..', 'server', 'desktop-app.module');
  console.log('[Dawini] Loading server module from:', modulePath);
  const { DesktopAppModule } = require(modulePath);

  nestApp = await NestFactory.create(DesktopAppModule, {
    logger: ['error', 'warn', 'log'],
  });

  nestApp.setGlobalPrefix('api');

  nestApp.use(helmet({ contentSecurityPolicy: false }));

  // Serve Angular static files FIRST (CSS, JS, assets)
  // no-cache so Chromium always revalidates on next launch — ensures deploys
  // are picked up without clearing the Electron userData cache manually.
  console.log('[Dawini] Serving Angular from:', ANGULAR_PATH);
  nestApp.use(express.static(ANGULAR_PATH, { etag: true, maxAge: 0, setHeaders: (res: any) => {
    res.setHeader('Cache-Control', 'no-cache');
  } }));

  nestApp.enableCors({ origin: true, credentials: true });

  nestApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  nestApp.useGlobalInterceptors(
    new ClassSerializerInterceptor(nestApp.get(Reflector)),
  );

  // SPA fallback — MUST be after all other middleware but before listen
  // This catches all non-API, non-static routes and serves index.html
  const fs = require('fs');
  const indexHtml = path.join(ANGULAR_PATH, 'index.html');
  if (fs.existsSync(indexHtml)) {
    nestApp.use((req: any, res: any, next: any) => {
      // Skip API routes — let NestJS handle them
      if (req.url.startsWith('/api')) return next();
      // Skip static file requests (have file extensions)
      if (req.url.match(/\.\w+$/)) return next();
      // Everything else → serve Angular index.html (SPA routing)
      res.sendFile(indexHtml);
    });
  }

  const port = process.env.PORT || 3333;
  await nestApp.listen(port, '0.0.0.0');
  console.log(`[Dawini] Server running on port ${port}`);
}

export async function stopServer(): Promise<void> {
  if (nestApp) {
    await nestApp.close();
    nestApp = null;
    console.log('[Dawini] Server stopped');
  }
}
