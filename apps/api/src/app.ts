import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';

import { authRoutes } from './features/auth/auth.routes.js';
import { registerAuthenticationHook } from './features/auth/auth.guard.js';
import type { AuthService } from './features/auth/auth.types.js';
import { homeRoutes } from './features/home/home.routes.js';
import type { HomeService } from './features/home/home.types.js';
import { masterDataRoutes } from './features/master-data/master-data.routes.js';
import type { MasterDataService } from './features/master-data/master-data.types.js';
import { workItemRoutes } from './features/work-items/work-item.routes.js';
import type { WorkItemService } from './features/work-items/work-item.types.js';

interface BuildAppOptions {
  authService: AuthService;
  cookieSecure: boolean;
  homeService: HomeService;
  masterDataService?: MasterDataService;
  workItemService: WorkItemService;
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
  app.register(
    async (protectedApp) => {
      registerAuthenticationHook(protectedApp, options.authService);
      protectedApp.register(homeRoutes, {
        prefix: '/home',
        homeService: options.homeService,
      });
      protectedApp.register(workItemRoutes, {
        workItemService: options.workItemService,
      });
      if (options.masterDataService) {
        protectedApp.register(masterDataRoutes, {
          prefix: '/master-data',
          masterDataService: options.masterDataService,
        });
      }
    },
    { prefix: '/api' },
  );

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
