import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/api/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      service: 'berecat-api',
    });
  });

  return app;
}
