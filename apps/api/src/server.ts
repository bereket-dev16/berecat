import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, db } from './db/client.js';
import { createAuthRepository } from './features/auth/auth.repository.js';
import { createAuthService } from './features/auth/auth.service.js';

const authRepository = createAuthRepository(db);
const authService = createAuthService(authRepository);
const app = buildApp({
  authService,
  cookieSecure: env.cookieSecure,
  closeResources: closeDatabase,
});
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);
let closePromise: Promise<void> | undefined;

function closeApp(): Promise<void> {
  closePromise ??= app.close();
  return closePromise;
}

async function shutdown(): Promise<void> {
  try {
    await closeApp();
  } catch {
    app.log.error('API kaynakları kapatılamadı.');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

try {
  await app.listen({ host, port });
} catch {
  app.log.error('API başlatılamadı.');
  process.exitCode = 1;
  await shutdown();
}
