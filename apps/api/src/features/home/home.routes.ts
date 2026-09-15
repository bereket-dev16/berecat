import type { FastifyPluginAsync } from 'fastify';

import type { HomeService } from './home.types.js';

interface HomeRoutesOptions {
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
  required: [
    'id',
    'title',
    'companyName',
    'description',
    'dueDate',
    'status',
    'completedAt',
    'assignees',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    companyName: { type: 'string' },
    description: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    dueDate: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    status: { type: 'string', enum: ['active', 'completed'] },
    completedAt: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
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
  { homeService },
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
      try {
        return reply.code(200).send(await homeService.getOverview());
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
