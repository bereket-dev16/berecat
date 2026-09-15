import { WORK_MODULE_KEYS } from './work-item.constants.js';

const uuidSchema = { type: 'string', format: 'uuid' } as const;
const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;
const nullableDateSchema = {
  anyOf: [
    { type: 'string', format: 'date' },
    { type: 'string', maxLength: 0 },
    { type: 'null' },
  ],
} as const;
const nullableDateTimeSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

function nullableTextSchema(maxLength: number) {
  return {
    anyOf: [{ type: 'string', maxLength }, { type: 'null' }],
  } as const;
}

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string' } },
} as const;

const creatorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username', 'displayName'],
  properties: {
    id: uuidSchema,
    username: { type: 'string' },
    displayName: { type: 'string' },
  },
} as const;

const nullableCreatorSchema = {
  anyOf: [creatorSchema, { type: 'null' }],
} as const;

export const userOptionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username', 'displayName', 'role', 'team'],
  properties: {
    id: uuidSchema,
    username: { type: 'string' },
    displayName: { type: 'string' },
    role: { type: 'string', enum: ['admin', 'member'] },
    team: { type: 'string', enum: ['graphic', 'digital'] },
  },
} as const;

export const assigneeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username', 'displayName', 'team'],
  properties: {
    id: uuidSchema,
    username: { type: 'string' },
    displayName: { type: 'string' },
    team: { type: 'string', enum: ['graphic', 'digital'] },
  },
} as const;

const commentReplySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'body',
    'createdAt',
    'author',
    'reactionCount',
    'reactedByCurrentUser',
  ],
  properties: {
    id: uuidSchema,
    body: { type: 'string' },
    createdAt: { type: 'string' },
    author: creatorSchema,
    reactionCount: { type: 'integer', minimum: 0 },
    reactedByCurrentUser: { type: 'boolean' },
  },
} as const;

export const commentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'body',
    'createdAt',
    'author',
    'reactionCount',
    'reactedByCurrentUser',
    'replies',
  ],
  properties: {
    ...commentReplySchema.properties,
    replies: { type: 'array', items: commentReplySchema },
  },
} as const;

export const createdCommentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'body',
    'createdAt',
    'parentCommentId',
    'author',
    'reactionCount',
    'reactedByCurrentUser',
  ],
  properties: {
    ...commentReplySchema.properties,
    parentCommentId: {
      anyOf: [uuidSchema, { type: 'null' }],
    },
  },
} as const;

export const eventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'type',
    'createdAt',
    'actor',
    'fromModuleKey',
    'fromModuleTitle',
    'toModuleKey',
    'toModuleTitle',
  ],
  properties: {
    id: uuidSchema,
    type: { type: 'string', enum: ['moved', 'completed', 'reopened'] },
    createdAt: { type: 'string' },
    actor: creatorSchema,
    fromModuleKey: {
      anyOf: [
        { type: 'string', enum: WORK_MODULE_KEYS },
        { type: 'null' },
      ],
    },
    fromModuleTitle: nullableStringSchema,
    toModuleKey: {
      anyOf: [
        { type: 'string', enum: WORK_MODULE_KEYS },
        { type: 'null' },
      ],
    },
    toModuleTitle: nullableStringSchema,
  },
} as const;

export const workItemSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'moduleKey',
    'title',
    'companyName',
    'description',
    'dueDate',
    'status',
    'completedAt',
    'assignees',
  ],
  properties: {
    id: uuidSchema,
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
    title: { type: 'string' },
    companyName: { type: 'string' },
    description: nullableStringSchema,
    dueDate: nullableStringSchema,
    status: { type: 'string', enum: ['active', 'completed'] },
    completedAt: nullableDateTimeSchema,
    assignees: { type: 'array', items: assigneeSchema },
  },
} as const;

export const workItemDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'moduleKey',
    'moduleTitle',
    'orderCode',
    'companyName',
    'productName',
    'packagingType',
    'supplierCompany',
    'orderType',
    'stockValue',
    'needOrderValue',
    'orderedQuantity',
    'receivedQuantity',
    'orderReceivedDate',
    'orderPlacedDate',
    'orderDeadlineDate',
    'orderShipmentDate',
    'processStage',
    'productDetail',
    'status',
    'completedAt',
    'completedBy',
    'assignees',
    'createdBy',
    'createdAt',
    'updatedAt',
    'comments',
    'events',
  ],
  properties: {
    id: uuidSchema,
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
    moduleTitle: { type: 'string' },
    orderCode: nullableStringSchema,
    companyName: { type: 'string' },
    productName: { type: 'string' },
    packagingType: nullableStringSchema,
    supplierCompany: nullableStringSchema,
    orderType: nullableStringSchema,
    stockValue: nullableStringSchema,
    needOrderValue: nullableStringSchema,
    orderedQuantity: nullableStringSchema,
    receivedQuantity: nullableStringSchema,
    orderReceivedDate: nullableStringSchema,
    orderPlacedDate: nullableStringSchema,
    orderDeadlineDate: nullableStringSchema,
    orderShipmentDate: nullableStringSchema,
    processStage: nullableStringSchema,
    productDetail: nullableStringSchema,
    status: { type: 'string', enum: ['active', 'completed'] },
    completedAt: nullableDateTimeSchema,
    completedBy: nullableCreatorSchema,
    assignees: { type: 'array', items: assigneeSchema },
    createdBy: creatorSchema,
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    comments: { type: 'array', items: commentSchema },
    events: { type: 'array', items: eventSchema },
  },
} as const;

export const workItemParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workItemId'],
  properties: { workItemId: uuidSchema },
} as const;

export const createWorkItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['moduleKey', 'companyName', 'productName'],
  properties: {
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
    orderCode: nullableTextSchema(100),
    companyName: { type: 'string', minLength: 1, maxLength: 200 },
    productName: { type: 'string', minLength: 1, maxLength: 250 },
    packagingType: nullableTextSchema(150),
    supplierCompany: nullableTextSchema(200),
    orderType: nullableTextSchema(50),
    stockValue: nullableTextSchema(100),
    needOrderValue: nullableTextSchema(100),
    orderedQuantity: nullableTextSchema(100),
    receivedQuantity: nullableTextSchema(100),
    orderReceivedDate: nullableDateSchema,
    orderPlacedDate: nullableDateSchema,
    orderDeadlineDate: nullableDateSchema,
    orderShipmentDate: nullableDateSchema,
    processStage: nullableTextSchema(150),
    productDetail: nullableStringSchema,
    assigneeIds: {
      type: 'array',
      uniqueItems: true,
      items: uuidSchema,
    },
  },
} as const;

export const updateWorkItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['companyName', 'productName'],
  properties: {
    orderCode: nullableTextSchema(100),
    companyName: { type: 'string', minLength: 1, maxLength: 200 },
    productName: { type: 'string', minLength: 1, maxLength: 250 },
    packagingType: nullableTextSchema(150),
    supplierCompany: nullableTextSchema(200),
    orderType: nullableTextSchema(50),
    stockValue: nullableTextSchema(100),
    needOrderValue: nullableTextSchema(100),
    orderedQuantity: nullableTextSchema(100),
    receivedQuantity: nullableTextSchema(100),
    orderReceivedDate: nullableDateSchema,
    orderPlacedDate: nullableDateSchema,
    orderDeadlineDate: nullableDateSchema,
    orderShipmentDate: nullableDateSchema,
    processStage: nullableTextSchema(150),
    productDetail: nullableStringSchema,
    assigneeIds: {
      type: 'array',
      uniqueItems: true,
      items: uuidSchema,
    },
  },
} as const;

export const deleteWorkItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['confirmation'],
  properties: {
    confirmation: { type: 'string' },
  },
} as const;

export const replaceAssigneesBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['userIds'],
  properties: {
    userIds: {
      type: 'array',
      uniqueItems: true,
      items: uuidSchema,
    },
  },
} as const;

export const moveWorkItemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['moduleKey'],
  properties: {
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
  },
} as const;

export const addCommentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['body'],
  properties: {
    body: { type: 'string', minLength: 1 },
    parentCommentId: {
      anyOf: [uuidSchema, { type: 'null' }],
    },
  },
} as const;

export const commentReactionParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workItemId', 'commentId'],
  properties: {
    workItemId: uuidSchema,
    commentId: uuidSchema,
  },
} as const;

export const commentReactionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reactionCount', 'reactedByCurrentUser'],
  properties: {
    reactionCount: { type: 'integer', minimum: 0 },
    reactedByCurrentUser: { type: 'boolean' },
  },
} as const;

export const archiveWorkItemsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 200 },
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
    completedBy: uuidSchema,
    completedFrom: { type: 'string', format: 'date' },
    completedTo: { type: 'string', format: 'date' },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100 },
  },
} as const;

const archiveWorkItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'orderCode',
    'companyName',
    'productName',
    'packagingType',
    'orderType',
    'orderedQuantity',
    'moduleKey',
    'moduleTitle',
    'completedAt',
    'completedBy',
  ],
  properties: {
    id: uuidSchema,
    orderCode: nullableStringSchema,
    companyName: { type: 'string' },
    productName: { type: 'string' },
    packagingType: nullableStringSchema,
    orderType: nullableStringSchema,
    orderedQuantity: nullableStringSchema,
    moduleKey: { type: 'string', enum: WORK_MODULE_KEYS },
    moduleTitle: { type: 'string' },
    completedAt: { type: 'string' },
    completedBy: creatorSchema,
  },
} as const;

export const archiveWorkItemListSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'pagination'],
  properties: {
    items: { type: 'array', items: archiveWorkItemSchema },
    pagination: {
      type: 'object',
      additionalProperties: false,
      required: ['page', 'pageSize', 'total', 'totalPages'],
      properties: {
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
} as const;

export const archiveSuggestionsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['q'],
  properties: {
    q: { type: 'string', minLength: 2, maxLength: 200 },
  },
} as const;

export const archiveSuggestionsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'value'],
        properties: {
          type: {
            type: 'string',
            enum: ['company', 'product', 'orderCode'],
          },
          value: { type: 'string' },
        },
      },
    },
  },
} as const;
