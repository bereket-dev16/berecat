import type { FastifyPluginAsync } from 'fastify';

import {
  MASTER_DATA_KINDS,
  MASTER_DATA_QUERY_MAX_LENGTH,
  MASTER_DATA_SUGGESTION_LIMIT_MAX,
} from './master-data.constants.js';
import type {
  MasterDataService,
  MasterDataSuggestionQueryInput,
} from './master-data.types.js';

interface MasterDataRoutesOptions {
  masterDataService: MasterDataService;
}

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string' } },
} as const;

const suggestionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: MASTER_DATA_KINDS },
    q: { type: 'string', maxLength: MASTER_DATA_QUERY_MAX_LENGTH },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: MASTER_DATA_SUGGESTION_LIMIT_MAX,
      default: 10,
    },
    company: { type: 'string', maxLength: 200 },
    product: { type: 'string', maxLength: 250 },
    packagingType: { type: 'string', maxLength: 150 },
  },
} as const;

const suggestionsResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      maxItems: MASTER_DATA_SUGGESTION_LIMIT_MAX,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'value'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          kind: { type: 'string', enum: MASTER_DATA_KINDS },
          value: { type: 'string' },
        },
      },
    },
  },
} as const;

export const masterDataRoutes: FastifyPluginAsync<
  MasterDataRoutesOptions
> = async (app, { masterDataService }) => {
  app.get<{ Querystring: MasterDataSuggestionQueryInput }>(
    '/suggestions',
    {
      schema: {
        querystring: suggestionsQuerySchema,
        response: {
          200: suggestionsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await masterDataService.getSuggestions(request.query);

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        return reply.code(200).send({ suggestions: result.value });
      } catch {
        request.log.error(
          'Ana veri önerileri alınırken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: 'Ana veri önerileri alınamadı.' });
      }
    },
  );
};
