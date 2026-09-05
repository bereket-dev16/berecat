import type { FastifyPluginAsync } from 'fastify';

import {
  AUTH_REQUEST_ERROR_MESSAGE,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_DURATION_SECONDS,
  INVALID_CREDENTIALS_MESSAGE,
} from './auth.constants.js';
import type { AuthService, PublicUser } from './auth.types.js';
import { USERNAME_MAX_LENGTH } from './username.js';

interface AuthRoutesOptions {
  authService: AuthService;
  cookieSecure: boolean;
}

interface LoginBody {
  username: string;
  password: string;
}

const publicUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username', 'displayName', 'role', 'team'],
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    displayName: { type: 'string' },
    role: { type: 'string', enum: ['admin', 'member'] },
    team: { type: 'string', enum: ['graphic', 'digital'] },
  },
} as const;

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['username', 'password'],
  properties: {
    username: {
      type: 'string',
      minLength: 1,
      maxLength: USERNAME_MAX_LENGTH,
    },
    password: { type: 'string' },
  },
} as const;

function safeUserResponse(user: PublicUser): { user: PublicUser } {
  return { user };
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { authService, cookieSecure },
) => {
  const commonCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: cookieSecure,
  };

  app.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        body: loginBodySchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['user'],
            properties: { user: publicUserSchema },
          },
          401: {
            type: 'object',
            additionalProperties: false,
            required: ['message'],
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.login(
          request.body.username,
          request.body.password,
        );

        if (!result) {
          return reply.code(401).send({
            message: INVALID_CREDENTIALS_MESSAGE,
          });
        }

        reply.setCookie(
          AUTH_SESSION_COOKIE_NAME,
          result.sessionToken,
          {
            ...commonCookieOptions,
            maxAge: AUTH_SESSION_DURATION_SECONDS,
          },
        );

        return reply.code(200).send(safeUserResponse(result.user));
      } catch {
        request.log.error('Giriş isteği işlenirken beklenmeyen bir hata oluştu.');
        return reply.code(500).send({ message: AUTH_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.get('/session', async (request, reply) => {
    const sessionToken = request.cookies[AUTH_SESSION_COOKIE_NAME];

    if (!sessionToken) {
      return reply.code(200).send({ user: null });
    }

    try {
      const user = await authService.getSession(sessionToken);

      if (!user) {
        reply.clearCookie(AUTH_SESSION_COOKIE_NAME, commonCookieOptions);
        return reply.code(200).send({ user: null });
      }

      return reply.code(200).send(safeUserResponse(user));
    } catch {
      request.log.error(
        'Oturum isteği işlenirken beklenmeyen bir hata oluştu.',
      );
      return reply.code(500).send({ message: AUTH_REQUEST_ERROR_MESSAGE });
    }
  });

  app.post('/logout', async (request, reply) => {
    const sessionToken = request.cookies[AUTH_SESSION_COOKIE_NAME];

    try {
      await authService.logout(sessionToken);
      reply.clearCookie(AUTH_SESSION_COOKIE_NAME, commonCookieOptions);
      return reply.code(204).send();
    } catch {
      request.log.error('Çıkış isteği işlenirken beklenmeyen bir hata oluştu.');
      return reply.code(500).send({ message: AUTH_REQUEST_ERROR_MESSAGE });
    }
  });
};
