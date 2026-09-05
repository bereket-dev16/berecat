import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';

import { authRoutes } from './features/auth/auth.routes.js';
import type { AuthService } from './features/auth/auth.types.js';

interface BuildAppOptions {
  authService: AuthService;
  cookieSecure: boolean;
  closeResources?: () => Promise<void>;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.register(cookie);
  app.register(authRoutes, {
    prefix: '/api/auth',
    authService: options.authService,
    cookieSecure: options.cookieSecure,
  });

  app.get('/api/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      service: 'berecat-api',
    });
  });

  if (options.closeResources) {
    app.addHook('onClose', async () => {
      await options.closeResources?.();
    });
  }

  return app;
}
