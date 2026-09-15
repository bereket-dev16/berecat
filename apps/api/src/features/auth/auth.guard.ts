import type { FastifyInstance } from 'fastify';

import { AUTH_SESSION_COOKIE_NAME } from './auth.constants.js';
import type { AuthService, PublicUser } from './auth.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser: PublicUser | null;
  }
}

export function registerAuthenticationHook(
  app: FastifyInstance,
  authService: AuthService,
): void {
  app.decorateRequest('authenticatedUser', null);

  app.addHook('preHandler', async (request, reply) => {
    const sessionToken = request.cookies[AUTH_SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return reply.code(401).send({ message: 'Oturum açmanız gerekiyor.' });
    }

    try {
      const user = await authService.getSession(sessionToken);

      if (!user) {
        return reply.code(401).send({ message: 'Oturum açmanız gerekiyor.' });
      }

      request.authenticatedUser = user;
    } catch {
      request.log.error('Oturum doğrulanırken beklenmeyen bir hata oluştu.');
      return reply.code(500).send({ message: 'İstek işlenemedi.' });
    }
  });
}
