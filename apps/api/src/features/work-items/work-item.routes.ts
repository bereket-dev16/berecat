import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { PublicUser } from '../auth/auth.types.js';
import {
  COMMENT_NOT_FOUND_MESSAGE,
  WORK_ITEM_NOT_FOUND_MESSAGE,
  WORK_ITEM_REQUEST_ERROR_MESSAGE,
} from './work-item.constants.js';
import {
  addCommentBodySchema,
  archiveSuggestionsQuerySchema,
  archiveSuggestionsSchema,
  archiveWorkItemListSchema,
  archiveWorkItemsQuerySchema,
  assigneeSchema,
  commentReactionParamsSchema,
  commentReactionSchema,
  createdCommentSchema,
  createWorkItemBodySchema,
  deleteWorkItemBodySchema,
  errorResponseSchema,
  moveWorkItemBodySchema,
  replaceAssigneesBodySchema,
  userOptionSchema,
  updateWorkItemBodySchema,
  workItemDetailSchema,
  workItemParamsSchema,
  workItemSummarySchema,
} from './work-item.schemas.js';
import type {
  ArchiveWorkItemsQueryInput,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  WorkItemService,
} from './work-item.types.js';

interface WorkItemRoutesOptions {
  workItemService: WorkItemService;
}

interface WorkItemParams {
  workItemId: string;
}

interface CommentReactionParams extends WorkItemParams {
  commentId: string;
}

interface DeleteWorkItemBody {
  confirmation: string;
}

interface ReplaceAssigneesBody {
  userIds: string[];
}

interface AddCommentBody {
  body: string;
  parentCommentId?: string | null;
}

interface ArchiveSuggestionsQuery {
  q: string;
}

interface MoveWorkItemBody {
  moduleKey: string;
}

function getAuthenticatedUser(request: FastifyRequest): PublicUser {
  if (!request.authenticatedUser) {
    throw new Error('Kimliği doğrulanmış kullanıcı bulunamadı.');
  }

  return request.authenticatedUser;
}

const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
} as const;

export const workItemRoutes: FastifyPluginAsync<WorkItemRoutesOptions> = async (
  app,
  { workItemService },
) => {
  app.setErrorHandler((error, request, reply) => {
    const isRequestError =
      typeof error === 'object' &&
      error !== null &&
      ('validation' in error ||
        ('statusCode' in error && error.statusCode === 400));

    if (isRequestError) {
      return reply
        .code(400)
        .send({ message: 'Gönderilen bilgiler geçersiz.' });
    }

    request.log.error('İş isteği işlenirken beklenmeyen bir hata oluştu.');
    return reply.code(500).send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
  });

  app.get(
    '/users/options',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['users'],
            properties: {
              users: { type: 'array', items: userOptionSchema },
            },
          },
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .code(200)
          .send({ users: await workItemService.listUserOptions() });
      } catch {
        request.log.error(
          'Kullanıcı seçenekleri alınırken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Body: CreateWorkItemInput }>(
    '/work-items',
    {
      schema: {
        body: createWorkItemBodySchema,
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemSummarySchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.createWorkItem(
          request.body,
          getAuthenticatedUser(request),
        );

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(201).send({ workItem: result.value });
      } catch {
        request.log.error('İş oluşturulurken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.get<{ Params: WorkItemParams }>(
    '/work-items/:workItemId',
    {
      schema: {
        params: workItemParamsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemDetailSchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.getWorkItem(
          request.params.workItemId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send({ workItem: result.value });
      } catch {
        request.log.error('İş detayı alınırken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.patch<{ Params: WorkItemParams; Body: UpdateWorkItemInput }>(
    '/work-items/:workItemId',
    {
      schema: {
        params: workItemParamsSchema,
        body: updateWorkItemBodySchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemSummarySchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.updateWorkItem(
          request.params.workItemId,
          request.body,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status === 'conflict') {
          return reply.code(409).send({ message: result.message });
        }

        return reply.code(200).send({ workItem: result.value });
      } catch {
        request.log.error('İş düzenlenirken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.delete<{ Params: WorkItemParams; Body: DeleteWorkItemBody }>(
    '/work-items/:workItemId',
    {
      schema: {
        params: workItemParamsSchema,
        body: deleteWorkItemBodySchema,
        response: {
          204: { type: 'null' },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.deleteWorkItem(
          request.params.workItemId,
          request.body.confirmation,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status === 'conflict') {
          return reply.code(409).send({ message: result.message });
        }

        return reply.code(204).send();
      } catch {
        request.log.error('İş silinirken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.put<{ Params: WorkItemParams; Body: ReplaceAssigneesBody }>(
    '/work-items/:workItemId/assignees',
    {
      schema: {
        params: workItemParamsSchema,
        body: replaceAssigneesBodySchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['assignees'],
            properties: {
              assignees: { type: 'array', items: assigneeSchema },
            },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.replaceAssignees(
          request.params.workItemId,
          request.body.userIds,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status === 'conflict') {
          return reply.code(409).send({ message: result.message });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send({ assignees: result.value });
      } catch {
        request.log.error('İş ataması değiştirilirken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Params: WorkItemParams }>(
    '/work-items/:workItemId/claim',
    {
      schema: {
        params: workItemParamsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['assignees'],
            properties: {
              assignees: { type: 'array', items: assigneeSchema },
            },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.claimWorkItem(
          request.params.workItemId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status === 'conflict') {
          return reply.code(409).send({ message: result.message });
        }

        return reply.code(200).send({ assignees: result.value });
      } catch {
        request.log.error('İş üzerine alınırken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Params: WorkItemParams; Body: MoveWorkItemBody }>(
    '/work-items/:workItemId/move',
    {
      schema: {
        params: workItemParamsSchema,
        body: moveWorkItemBodySchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemSummarySchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.moveWorkItem(
          request.params.workItemId,
          request.body.moduleKey,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status === 'conflict') {
          return reply.code(409).send({ message: result.message });
        }

        return reply.code(200).send({ workItem: result.value });
      } catch {
        request.log.error('İş aktarılırken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Params: WorkItemParams }>(
    '/work-items/:workItemId/complete',
    {
      schema: {
        params: workItemParamsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemSummarySchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.completeWorkItem(
          request.params.workItemId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send({ workItem: result.value });
      } catch {
        request.log.error('İş tamamlanırken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Params: WorkItemParams }>(
    '/work-items/:workItemId/reopen',
    {
      schema: {
        params: workItemParamsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['workItem'],
            properties: { workItem: workItemSummarySchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.reopenWorkItem(
          request.params.workItemId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send({ workItem: result.value });
      } catch {
        request.log.error('İş yeniden açılırken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.post<{ Params: WorkItemParams; Body: AddCommentBody }>(
    '/work-items/:workItemId/comments',
    {
      schema: {
        params: workItemParamsSchema,
        body: addCommentBodySchema,
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['comment'],
            properties: { comment: createdCommentSchema },
          },
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.addComment(
          request.params.workItemId,
          request.body.body,
          request.body.parentCommentId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: WORK_ITEM_NOT_FOUND_MESSAGE });
        }

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(201).send({ comment: result.value });
      } catch {
        request.log.error('Yorum eklenirken beklenmeyen bir hata oluştu.');
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.put<{ Params: CommentReactionParams }>(
    '/work-items/:workItemId/comments/:commentId/reaction',
    {
      schema: {
        params: commentReactionParamsSchema,
        response: {
          200: commentReactionSchema,
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.addCommentReaction(
          request.params.workItemId,
          request.params.commentId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: COMMENT_NOT_FOUND_MESSAGE });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send(result.value);
      } catch {
        request.log.error(
          'Yorum tepkisi eklenirken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.delete<{ Params: CommentReactionParams }>(
    '/work-items/:workItemId/comments/:commentId/reaction',
    {
      schema: {
        params: commentReactionParamsSchema,
        response: {
          200: commentReactionSchema,
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.removeCommentReaction(
          request.params.workItemId,
          request.params.commentId,
          getAuthenticatedUser(request),
        );

        if (result.status === 'not-found') {
          return reply.code(404).send({ message: COMMENT_NOT_FOUND_MESSAGE });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send(result.value);
      } catch {
        request.log.error(
          'Yorum tepkisi kaldırılırken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.get<{ Querystring: ArchiveWorkItemsQueryInput }>(
    '/archive/work-items',
    {
      schema: {
        querystring: archiveWorkItemsQuerySchema,
        response: {
          200: archiveWorkItemListSchema,
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.getArchiveWorkItems(
          request.query,
        );

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send(result.value);
      } catch {
        request.log.error(
          'Arşiv kayıtları alınırken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );

  app.get<{ Querystring: ArchiveSuggestionsQuery }>(
    '/archive/suggestions',
    {
      schema: {
        querystring: archiveSuggestionsQuerySchema,
        response: {
          200: archiveSuggestionsSchema,
          ...commonErrorResponses,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await workItemService.getArchiveSuggestions(
          request.query.q,
        );

        if (result.status === 'invalid') {
          return reply.code(400).send({ message: result.message });
        }

        if (result.status !== 'success') {
          return reply
            .code(500)
            .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
        }

        return reply.code(200).send({ suggestions: result.value });
      } catch {
        request.log.error(
          'Arşiv önerileri alınırken beklenmeyen bir hata oluştu.',
        );
        return reply
          .code(500)
          .send({ message: WORK_ITEM_REQUEST_ERROR_MESSAGE });
      }
    },
  );
};
