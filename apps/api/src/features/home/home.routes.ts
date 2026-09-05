import type { FastifyPluginAsync } from 'fastify';

import { AUTH_SESSION_COOKIE_NAME } from '../auth/auth.constants.js';
import type { AuthService } from '../auth/auth.types.js';
import type { HomeService } from './home.types.js';

interface HomeRoutesOptions {
  authService: AuthService;
  homeService: HomeService;
}

const assigneeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'displayName'],
  properties: {
    id: { type: 'string' },
    displayName: { type: 'string' },
  },
} as const;

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'description', 'dueDate', 'assignees'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    dueDate: { type: 'string' },
    assignees: { type: 'array', items: assigneeSchema },
  },
} as const;

const moduleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'items'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    items: { type: 'array', items: itemSchema },
  },
} as const;

const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: { type: 'string' },
  },
} as const;

export const homeRoutes: FastifyPluginAsync<HomeRoutesOptions> = async (
  app,
  { authService, homeService },
) => {
  app.get(
    '/overview',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['modules'],
            properties: {
              modules: { type: 'array', items: moduleSchema },
            },
          },
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const sessionToken = request.cookies[AUTH_SESSION_COOKIE_NAME];

      if (!sessionToken) {
        return reply.code(401).send({ message: 'Oturum açmanız gerekiyor.' });
      }

      try {
        const user = await authService.getSession(sessionToken);

        if (!user) {
          return reply
            .code(401)
            .send({ message: 'Oturum açmanız gerekiyor.' });
        }

        return reply.code(200).send(homeService.getOverview());
      } catch {
        request.log.error(
          'Anasayfa isteği işlenirken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: 'Anasayfa isteği işlenemedi.' });
      }
    },
  );
};
