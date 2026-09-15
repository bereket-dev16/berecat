import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { AuthService, PublicUser } from '../auth/auth.types.js';
import { createHomeService } from '../home/home.service.js';
import {
  WORK_MODULES,
  getWorkModuleTitle,
} from './work-item.constants.js';
import type { WorkModuleKey } from './work-item.constants.js';
import { createWorkItemService } from './work-item.service.js';
import type {
  AddCommentResult,
  ArchiveSuggestion,
  ArchiveWorkItemList,
  ClaimWorkItemResult,
  ChangeCommentReactionResult,
  CompleteWorkItemResult,
  CreateWorkItemResult,
  DeleteWorkItemResult,
  MoveWorkItemResult,
  NormalizedArchiveWorkItemsQuery,
  NormalizedCreateWorkItemInput,
  NormalizedUpdateWorkItemInput,
  ReopenWorkItemResult,
  ReplaceAssigneesResult,
  StoredHomeItem,
  UserOption,
  WorkItemAssignee,
  WorkItemComment,
  WorkItemDetail,
  WorkItemEvent,
  WorkItemRepository,
  WorkItemSummary,
  UpdateWorkItemResult,
} from './work-item.types.js';

const SESSION_TOKEN = 'gecerli-test-oturumu';
const SESSION_COOKIE = `berecat_session=${SESSION_TOKEN}`;
const SESSION_USER: PublicUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'test-kullanicisi',
  displayName: 'Test Kullanıcısı',
  role: 'member',
  team: 'graphic',
};
const SECOND_USER_ID = '00000000-0000-4000-8000-000000000002';
const INACTIVE_USER_ID = '00000000-0000-4000-8000-000000000003';
const PRIVATE_PASSWORD_HASH_SENTINEL = 'test-private-password-hash-sentinel';
const PRIVATE_SESSION_SENTINEL = 'test-private-session-token-sentinel';
const PRIVATE_SECRET_SENTINEL = 'test-private-secret-sentinel';

interface TestUser extends UserOption {
  isActive: boolean;
  passwordHash?: string;
  sessionToken?: string;
  privateSecret?: string;
}

interface StoredTestWorkItem extends NormalizedCreateWorkItemInput {
  id: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed';
  completedAt: Date | null;
  completedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  comments: StoredTestComment[];
  events: WorkItemEvent[];
}

interface StoredTestComment {
  id: string;
  body: string;
  createdAt: string;
  parentCommentId: string | null;
  author: WorkItemComment['author'];
  reactionUserIds: Set<string>;
}

const TEST_USERS: TestUser[] = [
  {
    ...SESSION_USER,
    isActive: true,
    passwordHash: PRIVATE_PASSWORD_HASH_SENTINEL,
    sessionToken: PRIVATE_SESSION_SENTINEL,
    privateSecret: PRIVATE_SECRET_SENTINEL,
  },
  {
    id: SECOND_USER_ID,
    username: 'ikinci-kullanici',
    displayName: 'İkinci Kullanıcı',
    role: 'member',
    team: 'digital',
    isActive: true,
  },
  {
    id: INACTIVE_USER_ID,
    username: 'pasif-kullanici',
    displayName: 'Pasif Kullanıcı',
    role: 'member',
    team: 'graphic',
    isActive: false,
  },
];

function createId(prefix: string, sequence: number): string {
  return `${prefix}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

class InMemoryWorkItemRepository implements WorkItemRepository {
  readonly items: StoredTestWorkItem[] = [];
  readonly assignments = new Map<string, string[]>();
  lastCreatedBy: string | undefined;
  lastAssignedBy: string | undefined;
  createTransactionCount = 0;
  private workItemSequence = 1;
  private commentSequence = 1;
  private eventSequence = 1;
  private clockSequence = 0;
  failNextWorkflowEvent = false;

  private now(): Date {
    const value = new Date(
      Date.UTC(2026, 8, 14, 10, this.clockSequence, 0),
    );
    this.clockSequence += 1;
    return value;
  }

  private findUser(userId: string): TestUser | undefined {
    return TEST_USERS.find((user) => user.id === userId);
  }

  private findAvailableItem(workItemId: string): StoredTestWorkItem | undefined {
    return this.items.find(
      (candidate) =>
        candidate.id === workItemId && candidate.deletedAt === null,
    );
  }

  private toAssignees(workItemId: string): WorkItemAssignee[] {
    return (this.assignments.get(workItemId) ?? [])
      .map((userId) => this.findUser(userId))
      .filter((user): user is TestUser => Boolean(user))
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        team: user.team,
      }));
  }

  private toSummary(item: StoredTestWorkItem): WorkItemSummary {
    return {
      id: item.id,
      moduleKey: item.moduleKey,
      title: item.productName,
      companyName: item.companyName,
      description: item.productDetail,
      dueDate: item.orderDeadlineDate,
      status: item.status,
      completedAt: item.completedAt?.toISOString() ?? null,
      assignees: this.toAssignees(item.id),
    };
  }

  private toThreadedComments(
    comments: StoredTestComment[],
    currentUserId: string,
  ): WorkItemComment[] {
    const roots = new Map<string, WorkItemComment>();
    const sortedComments = [...comments].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    for (const comment of sortedComments) {
      if (comment.parentCommentId === null) {
        roots.set(comment.id, {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          author: comment.author,
          reactionCount: comment.reactionUserIds.size,
          reactedByCurrentUser: comment.reactionUserIds.has(currentUserId),
          replies: [],
        });
      }
    }

    for (const comment of sortedComments) {
      if (comment.parentCommentId === null) {
        continue;
      }

      roots.get(comment.parentCommentId)?.replies.push({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: comment.author,
        reactionCount: comment.reactionUserIds.size,
        reactedByCurrentUser: comment.reactionUserIds.has(currentUserId),
      });
    }

    return [...roots.values()];
  }

  private areActiveUsers(userIds: string[]): boolean {
    return userIds.every((userId) => this.findUser(userId)?.isActive === true);
  }

  async listActiveUserOptions(): Promise<UserOption[]> {
    return TEST_USERS.filter((user) => user.isActive)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        team: user.team,
      }));
  }

  async listHomeItems(): Promise<StoredHomeItem[]> {
    return this.items
      .filter((item) => item.status === 'active' && item.deletedAt === null)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map((item) => ({
        id: item.id,
        moduleKey: item.moduleKey,
        title: item.productName,
        companyName: item.companyName,
        description: item.productDetail,
        dueDate: item.orderDeadlineDate,
        status: item.status,
        completedAt: item.completedAt?.toISOString() ?? null,
        assignees: this.toAssignees(item.id)
          .filter((assignee) => this.findUser(assignee.id)?.isActive)
          .map((assignee) => ({
            id: assignee.id,
            displayName: assignee.displayName,
          })),
      }));
  }

  async createWithAssignees(
    input: NormalizedCreateWorkItemInput,
    createdBy: string,
  ): Promise<CreateWorkItemResult> {
    this.createTransactionCount += 1;

    if (!this.areActiveUsers(input.assigneeIds)) {
      return { status: 'invalid-assignees' };
    }

    const createdAt = this.now();
    const item: StoredTestWorkItem = {
      ...input,
      id: createId('10000000', this.workItemSequence),
      createdBy,
      createdAt,
      updatedAt: createdAt,
      status: 'active',
      completedAt: null,
      completedBy: null,
      deletedAt: null,
      deletedBy: null,
      comments: [],
      events: [],
    };
    this.workItemSequence += 1;
    this.lastCreatedBy = createdBy;
    this.items.push(item);
    this.assignments.set(item.id, [...input.assigneeIds]);

    return { status: 'created', workItem: this.toSummary(item) };
  }

  async findDetail(
    workItemId: string,
    currentUserId: string,
  ): Promise<WorkItemDetail | null> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return null;
    }

    const creator = this.findUser(item.createdBy);

    if (!creator) {
      throw new Error('Test işinin oluşturan kullanıcısı bulunamadı.');
    }

    const completer = item.completedBy
      ? this.findUser(item.completedBy)
      : undefined;

    return {
      id: item.id,
      moduleKey: item.moduleKey,
      moduleTitle: getWorkModuleTitle(item.moduleKey),
      orderCode: item.orderCode,
      companyName: item.companyName,
      productName: item.productName,
      packagingType: item.packagingType,
      supplierCompany: item.supplierCompany,
      orderType: item.orderType,
      stockValue: item.stockValue,
      needOrderValue: item.needOrderValue,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      orderReceivedDate: item.orderReceivedDate,
      orderPlacedDate: item.orderPlacedDate,
      orderDeadlineDate: item.orderDeadlineDate,
      orderShipmentDate: item.orderShipmentDate,
      processStage: item.processStage,
      productDetail: item.productDetail,
      status: item.status,
      completedAt: item.completedAt?.toISOString() ?? null,
      completedBy: completer
        ? {
            id: completer.id,
            username: completer.username,
            displayName: completer.displayName,
          }
        : null,
      assignees: this.toAssignees(item.id),
      createdBy: {
        id: creator.id,
        username: creator.username,
        displayName: creator.displayName,
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      comments: this.toThreadedComments(item.comments, currentUserId),
      events: [...item.events].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    };
  }

  async updateWithAssignees(
    workItemId: string,
    input: NormalizedUpdateWorkItemInput,
    updatedBy: string,
  ): Promise<UpdateWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed' };
    }

    if (!this.areActiveUsers(input.assigneeIds)) {
      return { status: 'invalid-assignees' };
    }

    const { assigneeIds, ...values } = input;
    Object.assign(item, values);
    this.assignments.set(workItemId, [...assigneeIds]);
    this.lastAssignedBy = updatedBy;
    item.updatedAt = this.now();

    return { status: 'updated', workItem: this.toSummary(item) };
  }

  async softDelete(
    workItemId: string,
    deletedBy: string,
  ): Promise<DeleteWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed' };
    }

    const now = this.now();
    item.deletedAt = now;
    item.deletedBy = deletedBy;
    item.updatedAt = now;
    return { status: 'deleted' };
  }

  async replaceAssignees(
    workItemId: string,
    userIds: string[],
    assignedBy: string,
  ): Promise<ReplaceAssigneesResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed' };
    }

    if (!this.areActiveUsers(userIds)) {
      return { status: 'invalid-assignees' };
    }

    this.assignments.set(workItemId, [...userIds]);
    this.lastAssignedBy = assignedBy;
    item.updatedAt = this.now();
    return { status: 'updated', assignees: this.toAssignees(workItemId) };
  }

  async claim(
    workItemId: string,
    user: PublicUser,
  ): Promise<ClaimWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed' };
    }

    if (item.moduleKey !== 'incoming-orders') {
      return { status: 'wrong-module' };
    }

    const currentAssignments = this.assignments.get(workItemId) ?? [];

    if (currentAssignments.includes(user.id)) {
      return { status: 'claimed', assignees: this.toAssignees(workItemId) };
    }

    if (currentAssignments.length > 0) {
      return { status: 'conflict' };
    }

    this.assignments.set(workItemId, [user.id]);
    item.updatedAt = this.now();
    return { status: 'claimed', assignees: this.toAssignees(workItemId) };
  }

  private createEvent(
    type: WorkItemEvent['type'],
    actorId: string,
    createdAt: Date,
    fromModuleKey: WorkModuleKey | null = null,
    toModuleKey: WorkModuleKey | null = null,
  ): WorkItemEvent {
    const actor = this.findUser(actorId);

    if (!actor) {
      throw new Error('Test etkinliğinin kullanıcısı bulunamadı.');
    }

    const event: WorkItemEvent = {
      id: createId('30000000', this.eventSequence),
      type,
      createdAt: createdAt.toISOString(),
      actor: {
        id: actor.id,
        username: actor.username,
        displayName: actor.displayName,
      },
      fromModuleKey,
      fromModuleTitle: fromModuleKey
        ? getWorkModuleTitle(fromModuleKey)
        : null,
      toModuleKey,
      toModuleTitle: toModuleKey ? getWorkModuleTitle(toModuleKey) : null,
    };
    this.eventSequence += 1;
    return event;
  }

  private failWorkflowEventIfRequested(rollback: () => void): void {
    if (!this.failNextWorkflowEvent) {
      return;
    }

    this.failNextWorkflowEvent = false;
    rollback();
    throw new Error('Test etkinlik insert hatası.');
  }

  async move(
    workItemId: string,
    moduleKey: WorkModuleKey,
    actorId: string,
  ): Promise<MoveWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed' };
    }

    if (item.moduleKey === moduleKey) {
      return { status: 'same-module' };
    }

    const previousModuleKey = item.moduleKey;
    const previousUpdatedAt = item.updatedAt;
    const createdAt = this.now();
    item.moduleKey = moduleKey;
    item.updatedAt = createdAt;
    this.failWorkflowEventIfRequested(() => {
      item.moduleKey = previousModuleKey;
      item.updatedAt = previousUpdatedAt;
    });
    item.events.push(
      this.createEvent(
        'moved',
        actorId,
        createdAt,
        previousModuleKey,
        moduleKey,
      ),
    );
    return { status: 'moved', workItem: this.toSummary(item) };
  }

  async complete(
    workItemId: string,
    actorId: string,
  ): Promise<CompleteWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'completed') {
      return { status: 'completed', workItem: this.toSummary(item) };
    }

    const previousUpdatedAt = item.updatedAt;
    const createdAt = this.now();
    item.status = 'completed';
    item.completedAt = createdAt;
    item.completedBy = actorId;
    item.updatedAt = createdAt;
    this.failWorkflowEventIfRequested(() => {
      item.status = 'active';
      item.completedAt = null;
      item.completedBy = null;
      item.updatedAt = previousUpdatedAt;
    });
    item.events.push(this.createEvent('completed', actorId, createdAt));
    return { status: 'completed', workItem: this.toSummary(item) };
  }

  async reopen(
    workItemId: string,
    actorId: string,
  ): Promise<ReopenWorkItemResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (item.status === 'active') {
      return { status: 'reopened', workItem: this.toSummary(item) };
    }

    const previousCompletedAt = item.completedAt;
    const previousCompletedBy = item.completedBy;
    const previousUpdatedAt = item.updatedAt;
    const createdAt = this.now();
    item.status = 'active';
    item.completedAt = null;
    item.completedBy = null;
    item.updatedAt = createdAt;
    this.failWorkflowEventIfRequested(() => {
      item.status = 'completed';
      item.completedAt = previousCompletedAt;
      item.completedBy = previousCompletedBy;
      item.updatedAt = previousUpdatedAt;
    });
    item.events.push(this.createEvent('reopened', actorId, createdAt));
    return { status: 'reopened', workItem: this.toSummary(item) };
  }

  async addComment(
    workItemId: string,
    body: string,
    parentCommentId: string | null,
    author: PublicUser,
  ): Promise<AddCommentResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    if (parentCommentId) {
      const parentComment = this.items
        .flatMap((candidate) => candidate.comments)
        .find((candidate) => candidate.id === parentCommentId);

      if (!parentComment) {
        return { status: 'parent-not-found' };
      }

      if (!item.comments.includes(parentComment)) {
        return { status: 'parent-work-item-mismatch' };
      }

      if (parentComment.parentCommentId !== null) {
        return { status: 'nested-reply' };
      }
    }

    const comment: StoredTestComment = {
      id: createId('20000000', this.commentSequence),
      body,
      createdAt: this.now().toISOString(),
      parentCommentId,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
      },
      reactionUserIds: new Set(),
    };
    this.commentSequence += 1;
    item.comments.push(comment);
    return {
      status: 'created',
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        parentCommentId: comment.parentCommentId,
        author: comment.author,
        reactionCount: 0,
        reactedByCurrentUser: false,
      },
    };
  }

  async addCommentReaction(
    workItemId: string,
    commentId: string,
    userId: string,
  ): Promise<ChangeCommentReactionResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    const comment = item.comments.find((candidate) => candidate.id === commentId);

    if (!comment) {
      return { status: 'comment-not-found' };
    }

    comment.reactionUserIds.add(userId);
    return {
      status: 'updated',
      reaction: {
        reactionCount: comment.reactionUserIds.size,
        reactedByCurrentUser: true,
      },
    };
  }

  async removeCommentReaction(
    workItemId: string,
    commentId: string,
    userId: string,
  ): Promise<ChangeCommentReactionResult> {
    const item = this.findAvailableItem(workItemId);

    if (!item) {
      return { status: 'not-found' };
    }

    const comment = item.comments.find((candidate) => candidate.id === commentId);

    if (!comment) {
      return { status: 'comment-not-found' };
    }

    comment.reactionUserIds.delete(userId);
    return {
      status: 'updated',
      reaction: {
        reactionCount: comment.reactionUserIds.size,
        reactedByCurrentUser: false,
      },
    };
  }

  async listArchiveWorkItems(
    query: NormalizedArchiveWorkItemsQuery,
  ): Promise<ArchiveWorkItemList> {
    const normalizedSearch = query.q?.toLocaleLowerCase('tr-TR') ?? null;
    const filteredItems = this.items
      .filter(
        (item) => item.status === 'completed' && item.deletedAt === null,
      )
      .filter((item) => !query.moduleKey || item.moduleKey === query.moduleKey)
      .filter(
        (item) => !query.completedBy || item.completedBy === query.completedBy,
      )
      .filter((item) => {
        const completedDate = item.completedAt?.toISOString().slice(0, 10);
        return !query.completedFrom ||
          (completedDate && completedDate >= query.completedFrom);
      })
      .filter((item) => {
        const completedDate = item.completedAt?.toISOString().slice(0, 10);
        return !query.completedTo ||
          (completedDate && completedDate <= query.completedTo);
      })
      .filter((item) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          item.orderCode,
          item.companyName,
          item.productName,
          item.supplierCompany,
          item.packagingType,
          item.orderType,
          item.productDetail,
        ].some((value) =>
          value?.toLocaleLowerCase('tr-TR').includes(normalizedSearch),
        );
      })
      .sort(
        (left, right) =>
          (right.completedAt?.getTime() ?? 0) -
          (left.completedAt?.getTime() ?? 0),
      );
    const offset = (query.page - 1) * query.pageSize;
    const pageItems = filteredItems.slice(offset, offset + query.pageSize);

    return {
      items: pageItems.map((item) => {
        const completedBy = item.completedBy
          ? this.findUser(item.completedBy)
          : undefined;

        if (!item.completedAt || !completedBy) {
          throw new Error('Test arşiv kaydı geçersiz.');
        }

        return {
          id: item.id,
          orderCode: item.orderCode,
          companyName: item.companyName,
          productName: item.productName,
          packagingType: item.packagingType,
          orderType: item.orderType,
          orderedQuantity: item.orderedQuantity,
          moduleKey: item.moduleKey,
          moduleTitle: getWorkModuleTitle(item.moduleKey),
          completedAt: item.completedAt.toISOString(),
          completedBy: {
            id: completedBy.id,
            username: completedBy.username,
            displayName: completedBy.displayName,
          },
        };
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / query.pageSize),
      },
    };
  }

  async listArchiveSuggestions(query: string): Promise<ArchiveSuggestion[]> {
    const normalizedQuery = query.toLocaleLowerCase('tr-TR');
    const suggestions: ArchiveSuggestion[] = [];
    const seenValues = new Set<string>();

    for (const item of this.items.filter(
      (candidate) =>
        candidate.status === 'completed' && candidate.deletedAt === null,
    )) {
      const candidates: ArchiveSuggestion[] = [
        { type: 'company', value: item.companyName },
        { type: 'product', value: item.productName },
        ...(item.orderCode
          ? [{ type: 'orderCode' as const, value: item.orderCode }]
          : []),
      ];

      for (const suggestion of candidates) {
        const normalizedValue = suggestion.value.toLocaleLowerCase('tr-TR');

        if (
          !normalizedValue.includes(normalizedQuery) ||
          seenValues.has(normalizedValue)
        ) {
          continue;
        }

        seenValues.add(normalizedValue);
        suggestions.push(suggestion);

        if (suggestions.length === 10) {
          return suggestions;
        }
      }
    }

    return suggestions;
  }
}

const AUTH_SERVICE: AuthService = {
  async login() {
    return null;
  },
  async getSession(sessionToken) {
    return sessionToken === SESSION_TOKEN ? SESSION_USER : null;
  },
  async logout() {},
};

const REQUIRED_CREATE_PAYLOAD = {
  moduleKey: 'incoming-orders',
  companyName: 'Test Firması',
  productName: 'Test Ürünü',
} as const;

function createTestContext(): {
  app: FastifyInstance;
  repository: InMemoryWorkItemRepository;
} {
  const repository = new InMemoryWorkItemRepository();
  const workItemService = createWorkItemService(repository);
  const app = buildApp({
    authService: AUTH_SERVICE,
    cookieSecure: false,
    homeService: createHomeService(repository),
    workItemService,
    logger: false,
  });

  return { app, repository };
}

async function authenticatedRequest(
  app: FastifyInstance,
  options: InjectOptions,
) {
  return app.inject({
    ...options,
    headers: { ...options.headers, cookie: SESSION_COOKIE },
  });
}

async function createWorkItem(
  app: FastifyInstance,
  payload: Record<string, unknown> = REQUIRED_CREATE_PAYLOAD,
) {
  return authenticatedRequest(app, {
    method: 'POST',
    url: '/api/work-items',
    payload,
  });
}

describe('Phase 02A iş API akışları', () => {
  let app: FastifyInstance;
  let repository: InMemoryWorkItemRepository;

  beforeEach(() => {
    ({ app, repository } = createTestContext());
  });

  afterEach(async () => {
    await app.close();
  });

  it('login olmayan kullanıcının iş oluşturmasını reddeder', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/work-items',
      payload: REQUIRED_CREATE_PAYLOAD,
    });

    expect(response.statusCode).toBe(401);
  });

  it('geçerli iş oluşturma isteğine HTTP 201 döner', async () => {
    const response = await createWorkItem(app);

    expect(response.statusCode).toBe(201);
    expect(response.json().workItem).toMatchObject({
      moduleKey: 'incoming-orders',
      title: 'Test Ürünü',
      companyName: 'Test Firması',
    });
  });

  it('createdBy değerini session kullanıcısından alır', async () => {
    await createWorkItem(app);

    expect(repository.lastCreatedBy).toBe(SESSION_USER.id);
  });

  it('Firma İsmi eksikse validation hatası döner', async () => {
    const response = await createWorkItem(app, {
      moduleKey: 'incoming-orders',
      productName: 'Test Ürünü',
    });

    expect(response.statusCode).toBe(400);
  });

  it('Ürün eksikse validation hatası döner', async () => {
    const response = await createWorkItem(app, {
      moduleKey: 'incoming-orders',
      companyName: 'Test Firması',
    });

    expect(response.statusCode).toBe(400);
  });

  it('geçersiz moduleKey değerini reddeder', async () => {
    const response = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'bilinmeyen-modul',
    });

    expect(response.statusCode).toBe(400);
    expect(repository.items).toHaveLength(0);
  });

  it('işi ve ilk atamaları tek repository transaction işlemiyle oluşturur', async () => {
    const response = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      assigneeIds: [SESSION_USER.id, SECOND_USER_ID],
    });
    const workItemId = response.json().workItem.id as string;

    expect(response.statusCode).toBe(201);
    expect(repository.createTransactionCount).toBe(1);
    expect(repository.items).toHaveLength(1);
    expect(repository.assignments.get(workItemId)).toEqual([
      SESSION_USER.id,
      SECOND_USER_ID,
    ]);
  });

  it('kullanıcı seçeneklerinde yalnız aktif kullanıcıları döndürür', async () => {
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/users/options',
    });
    const body = response.json<{ users: UserOption[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.users.map((user) => user.id)).toEqual([
      SECOND_USER_ID,
      SESSION_USER.id,
    ]);
    expect(body.users.map((user) => user.id)).not.toContain(INACTIVE_USER_ID);
  });

  it('home overview veritabanı kayıtlarını doğru modüllere yerleştirir', async () => {
    await createWorkItem(app);
    await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'digital',
      productName: 'Dijital Test İşi',
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const body = response.json<{
      modules: Array<{ id: string; items: Array<{ title: string }> }>;
    }>();

    expect(
      body.modules.find((module) => module.id === 'incoming-orders')?.items,
    ).toHaveLength(1);
    expect(body.modules.find((module) => module.id === 'digital')?.items[0]?.title)
      .toBe('Dijital Test İşi');
  });

  it('home modüllerini tanımlanan yedi modül sırasıyla döndürür', async () => {
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const body = response.json<{ modules: Array<{ id: string }> }>();

    expect(body.modules.map((module) => module.id)).toEqual(
      WORK_MODULES.map((module) => module.key),
    );
  });

  it('aynı modülde en yeni işi üstte döndürür', async () => {
    await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Eski Test İşi',
    });
    await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Yeni Test İşi',
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const body = response.json<{
      modules: Array<{ id: string; items: Array<{ title: string }> }>;
    }>();

    expect(
      body.modules
        .find((module) => module.id === 'incoming-orders')
        ?.items.map((item) => item.title),
    ).toEqual(['Yeni Test İşi', 'Eski Test İşi']);
  });

  it('iş detayı bütün güvenli alanları döndürür', async () => {
    const createResponse = await createWorkItem(app, {
      moduleKey: 'incoming-orders',
      orderCode: 'TEST-01',
      companyName: '  Test Firması  ',
      productName: '  Test Ürünü  ',
      packagingType: 'Kutu',
      supplierCompany: 'Test Tedarikçisi',
      orderType: 'Standart',
      stockValue: 'STOK',
      needOrderValue: '?',
      orderedQuantity: '210 - 6,5',
      receivedQuantity: '-',
      orderReceivedDate: '2026-09-10',
      orderPlacedDate: '2026-09-11',
      orderDeadlineDate: '2026-09-20',
      orderShipmentDate: '2026-09-21',
      processStage: 'Hazırlık',
      productDetail: '  Güvenli test detayı  ',
      assigneeIds: [SECOND_USER_ID],
    });
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });
    const workItem = response.json().workItem as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(workItem).toMatchObject({
      id: workItemId,
      moduleKey: 'incoming-orders',
      moduleTitle: 'Gelen Siparişler',
      orderCode: 'TEST-01',
      companyName: 'Test Firması',
      productName: 'Test Ürünü',
      packagingType: 'Kutu',
      supplierCompany: 'Test Tedarikçisi',
      orderType: 'Standart',
      stockValue: 'STOK',
      needOrderValue: '?',
      orderedQuantity: '210 - 6,5',
      receivedQuantity: '-',
      orderReceivedDate: '2026-09-10',
      orderPlacedDate: '2026-09-11',
      orderDeadlineDate: '2026-09-20',
      orderShipmentDate: '2026-09-21',
      processStage: 'Hazırlık',
      productDetail: 'Güvenli test detayı',
      assignees: [
        {
          id: SECOND_USER_ID,
          username: 'ikinci-kullanici',
          displayName: 'İkinci Kullanıcı',
          team: 'digital',
        },
      ],
      createdBy: {
        id: SESSION_USER.id,
        username: SESSION_USER.username,
        displayName: SESSION_USER.displayName,
      },
      comments: [],
    });
    expect(workItem).toHaveProperty('createdAt');
    expect(workItem).toHaveProperty('updatedAt');
  });

  it('bulunmayan iş için HTTP 404 döndürür', async () => {
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/work-items/99999999-0000-4000-8000-000000000001',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'İş bulunamadı.' });
  });

  it('atama listesini değiştirebilir', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/assignees`,
      payload: { userIds: [SECOND_USER_ID] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assignees).toEqual([
      expect.objectContaining({ id: SECOND_USER_ID }),
    ]);
  });

  it('boş atama dizisi bütün atamaları kaldırır', async () => {
    const createResponse = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      assigneeIds: [SECOND_USER_ID],
    });
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/assignees`,
      payload: { userIds: [] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ assignees: [] });
  });

  it('atanmamış incoming-orders işini session kullanıcısına claim eder', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/claim`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assignees).toEqual([
      expect.objectContaining({ id: SESSION_USER.id }),
    ]);
  });

  it('başka kullanıcıya atanmış işin claim işleminde HTTP 409 döndürür', async () => {
    const createResponse = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      assigneeIds: [SECOND_USER_ID],
    });
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/claim`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Bu iş başka bir kullanıcı tarafından alınmış.',
    });
  });

  it('incoming-orders dışındaki işi claim etmeyi reddeder', async () => {
    const createResponse = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'new-designs',
    });
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/claim`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('işe trim edilmiş düz metin yorum ekler', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: '  Test yorumu  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().comment).toMatchObject({
      body: 'Test yorumu',
      author: { id: SESSION_USER.id },
    });
  });

  it('trim sonrası boş yorumu reddeder', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: '   ' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('yorum uzunluğunu trim sonrası Unicode karakterleriyle değerlendirir', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json<{ workItem: { id: string } }>()
      .workItem.id;
    const body = `  ${'🐈'.repeat(2_000)}  `;

    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ comment: { body: string } }>().comment.body).toBe(
      '🐈'.repeat(2_000),
    );
  });

  it('yorumları oluşturulma tarihine göre eski-yeni sıralar', async () => {
    const createResponse = await createWorkItem(app);
    const workItemId = createResponse.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'İlk yorum' },
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'İkinci yorum' },
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(
      response.json().workItem.comments.map(
        (comment: WorkItemComment) => comment.body,
      ),
    ).toEqual(['İlk yorum', 'İkinci yorum']);
  });

  it('response gövdelerinde private veya secret alan döndürmez', async () => {
    const createResponse = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      assigneeIds: [SECOND_USER_ID],
    });
    const workItemId = createResponse.json().workItem.id as string;
    const responses = [
      createResponse,
      await authenticatedRequest(app, {
        method: 'GET',
        url: '/api/users/options',
      }),
      await authenticatedRequest(app, {
        method: 'GET',
        url: '/api/home/overview',
      }),
      await authenticatedRequest(app, {
        method: 'GET',
        url: `/api/work-items/${workItemId}`,
      }),
      await authenticatedRequest(app, {
        method: 'PUT',
        url: `/api/work-items/${workItemId}/assignees`,
        payload: { userIds: [] },
      }),
      await authenticatedRequest(app, {
        method: 'POST',
        url: `/api/work-items/${workItemId}/claim`,
      }),
      await authenticatedRequest(app, {
        method: 'POST',
        url: `/api/work-items/${workItemId}/comments`,
        payload: { body: 'Güvenli test yorumu' },
      }),
    ];
    const combinedBody = responses
      .map((response) => response.body)
      .join(' ')
      .toLowerCase();

    for (const privateTerm of [
      'password',
      'passwordhash',
      'password_hash',
      'token',
      'tokenhash',
      'token_hash',
      'secret',
      SESSION_TOKEN.toLowerCase(),
    ]) {
      expect(combinedBody).not.toContain(privateTerm);
    }
  });

  it('aktif işi başka bir birime aktarabilir', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'new-designs' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('aktarım işin mevcut birimini değiştirir', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'revisions' },
    });

    expect(response.json().workItem.moduleKey).toBe('revisions');
    expect(repository.items[0]?.moduleKey).toBe('revisions');
  });

  it('aktarım moved etkinliği oluşturur', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'team-approval' },
    });

    expect(repository.items[0]?.events).toHaveLength(1);
    expect(repository.items[0]?.events[0]?.type).toBe('moved');
  });

  it('aktarım etkinliğinde session kullanıcısını actor olarak kaydeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'pricing' },
    });

    expect(repository.items[0]?.events[0]?.actor.id).toBe(SESSION_USER.id);
  });

  it('aktarım etkinliğinde kaynak ve hedef birimi kaydeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'digital' },
    });

    expect(repository.items[0]?.events[0]).toMatchObject({
      fromModuleKey: 'incoming-orders',
      fromModuleTitle: 'Gelen Siparişler',
      toModuleKey: 'digital',
      toModuleTitle: 'Dijital',
    });
  });

  it('aynı birime aktarımı exact hata mesajıyla reddeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'incoming-orders' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'İş zaten seçilen birimde.' });
  });

  it('aktarımda geçersiz moduleKey değerini reddeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'gecersiz-birim' },
    });

    expect(response.statusCode).toBe(400);
    expect(repository.items[0]?.moduleKey).toBe('incoming-orders');
  });

  it('tamamlanmış işi aktarmayı exact conflict mesajıyla reddeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'digital' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Tamamlanmış iş aktarılamaz. Önce işi yeniden açın.',
    });
  });

  it('aktif işi tamamlar', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workItem.status).toBe('completed');
  });

  it('tamamlama completedAt ve completedBy alanlarını doldurur', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(detail.json().workItem.completedAt).toEqual(expect.any(String));
    expect(detail.json().workItem.completedBy).toMatchObject({
      id: SESSION_USER.id,
      username: SESSION_USER.username,
      displayName: SESSION_USER.displayName,
    });
  });

  it('tamamlama completed etkinliği oluşturur', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });

    expect(repository.items[0]?.events).toEqual([
      expect.objectContaining({ type: 'completed' }),
    ]);
  });

  it('ikinci tamamlama çağrısında yeni etkinlik oluşturmaz', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });

    expect(response.statusCode).toBe(200);
    expect(repository.items[0]?.events).toHaveLength(1);
  });

  it('tamamlanmış işi yeniden açar', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workItem.status).toBe('active');
  });

  it('yeniden açma tamamlanma alanlarını temizler', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(detail.json().workItem).toMatchObject({
      status: 'active',
      completedAt: null,
      completedBy: null,
    });
  });

  it('yeniden açma reopened etkinliği oluşturur', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });

    expect(repository.items[0]?.events.map((event) => event.type)).toEqual([
      'completed',
      'reopened',
    ]);
  });

  it('ikinci yeniden açma çağrısında yeni etkinlik oluşturmaz', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });

    expect(response.statusCode).toBe(200);
    expect(repository.items[0]?.events).toHaveLength(2);
  });

  it('tamamlanmış işin atamasını exact conflict mesajıyla engeller', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/assignees`,
      payload: { userIds: [SECOND_USER_ID] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Tamamlanmış işin ataması değiştirilemez.',
    });
  });

  it('tamamlanmış işi üzerine almayı exact conflict mesajıyla engeller', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/claim`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Tamamlanmış iş üzerinize alınamaz.',
    });
  });

  it('tamamlanmış işe yorum eklemeye devam eder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Tamamlanan iş yorumu' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().comment.body).toBe('Tamamlanan iş yorumu');
  });

  it('detay yanıtında status ve etkinlik geçmişini döndürür', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'new-designs' },
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workItem.status).toBe('completed');
    expect(
      response.json().workItem.events.map((event: WorkItemEvent) => event.type),
    ).toEqual(['moved', 'completed']);
  });

  it('home overview tamamlanmış işi dönmez', async () => {
    const created = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'pricing',
    });
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const pricingItems = response
      .json()
      .modules.find((module: { id: string }) => module.id === 'pricing').items;

    expect(pricingItems).toEqual([]);
  });

  it('home overview yalnız aktif işleri döndürür', async () => {
    const active = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Aktif İş',
    });
    const completed = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Tamamlanmış İş',
    });
    const completedId = completed.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${completedId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const items = response
      .json()
      .modules.find(
        (module: { id: string }) => module.id === 'incoming-orders',
      ).items;

    expect(items.map((item: { id: string }) => item.id)).toEqual([
      active.json().workItem.id,
    ]);
  });

  it('iş akışı yanıtlarında parola, token veya secret döndürmez', async () => {
    expect(TEST_USERS[0]).toMatchObject({
      passwordHash: PRIVATE_PASSWORD_HASH_SENTINEL,
      sessionToken: PRIVATE_SESSION_SENTINEL,
      privateSecret: PRIVATE_SECRET_SENTINEL,
    });
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const responses = [
      await authenticatedRequest(app, {
        method: 'POST',
        url: `/api/work-items/${workItemId}/move`,
        payload: { moduleKey: 'digital' },
      }),
      await authenticatedRequest(app, {
        method: 'POST',
        url: `/api/work-items/${workItemId}/complete`,
      }),
      await authenticatedRequest(app, {
        method: 'GET',
        url: `/api/work-items/${workItemId}`,
      }),
      await authenticatedRequest(app, {
        method: 'POST',
        url: `/api/work-items/${workItemId}/reopen`,
      }),
    ];
    const body = responses.map((response) => response.body).join(' ').toLowerCase();
    const detailBody = responses[2]?.json().workItem;

    expect(body).not.toMatch(/password|token|secret/);
    expect(body).not.toContain(SESSION_TOKEN.toLowerCase());
    expect(body).not.toContain(PRIVATE_PASSWORD_HASH_SENTINEL);
    expect(body).not.toContain(PRIVATE_SESSION_SENTINEL);
    expect(body).not.toContain(PRIVATE_SECRET_SENTINEL);
    expect(Object.keys(detailBody.completedBy).sort()).toEqual([
      'displayName',
      'id',
      'username',
    ]);
    expect(Object.keys(detailBody.events[0].actor).sort()).toEqual([
      'displayName',
      'id',
      'username',
    ]);
    for (const response of responses) {
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('aktarım etkinliği yazılamazsa durum değişikliğini geri alır', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    repository.failNextWorkflowEvent = true;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/move`,
      payload: { moduleKey: 'digital' },
    });

    expect(response.statusCode).toBe(500);
    expect(repository.items[0]).toMatchObject({
      moduleKey: 'incoming-orders',
      events: [],
    });
  });

  it('tamamlama etkinliği yazılamazsa durum değişikliğini geri alır', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    repository.failNextWorkflowEvent = true;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });

    expect(response.statusCode).toBe(500);
    expect(repository.items[0]).toMatchObject({
      status: 'active',
      completedAt: null,
      completedBy: null,
      events: [],
    });
  });

  it('yeniden açma etkinliği yazılamazsa durum değişikliğini geri alır', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    repository.failNextWorkflowEvent = true;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });

    expect(response.statusCode).toBe(500);
    expect(repository.items[0]?.status).toBe('completed');
    expect(repository.items[0]?.completedAt).not.toBeNull();
    expect(repository.items[0]?.completedBy).toBe(SESSION_USER.id);
    expect(repository.items[0]?.events.map((event) => event.type)).toEqual([
      'completed',
    ]);
  });

  it('orderPlacedDate dolu ve termin boşsa 10 iş günü sonrasını kaydeder', async () => {
    const created = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      orderPlacedDate: '2026-09-14',
    });
    const workItemId = created.json().workItem.id as string;
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(created.statusCode).toBe(201);
    expect(detail.json().workItem.orderDeadlineDate).toBe('2026-09-28');
  });

  it('kullanıcının gönderdiği termin tarihini otomatik değerle ezmez', async () => {
    const created = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      orderPlacedDate: '2026-09-14',
      orderDeadlineDate: '2026-10-12',
    });
    const workItemId = created.json().workItem.id as string;
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(detail.json().workItem.orderDeadlineDate).toBe('2026-10-12');
  });

  it('ana yoruma tek seviyeli yanıt oluşturur', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const rootComment = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Ana yorum' },
    });
    const parentCommentId = rootComment.json().comment.id as string;
    const reply = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Yanıt', parentCommentId },
    });

    expect(reply.statusCode).toBe(201);
    expect(reply.json().comment).toMatchObject({
      body: 'Yanıt',
      parentCommentId,
      author: {
        id: SESSION_USER.id,
        username: SESSION_USER.username,
        displayName: SESSION_USER.displayName,
      },
    });
    expect(Object.keys(reply.json().comment.author).sort()).toEqual([
      'displayName',
      'id',
      'username',
    ]);
  });

  it('başka işe ait parent yorumu reddeder', async () => {
    const first = await createWorkItem(app);
    const second = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'İkinci İş',
    });
    const firstId = first.json().workItem.id as string;
    const secondId = second.json().workItem.id as string;
    const rootComment = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${firstId}/comments`,
      payload: { body: 'Birinci iş yorumu' },
    });
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${secondId}/comments`,
      payload: {
        body: 'Yanlış işe yanıt',
        parentCommentId: rootComment.json().comment.id,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('bulunmayan parent yorumu reddeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: {
        body: 'Bulunmayan yoruma yanıt',
        parentCommentId: '99999999-0000-4000-8000-000000000001',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('bir reply altına ikinci seviye reply eklenmesini reddeder', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const root = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Ana yorum' },
    });
    const reply = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: {
        body: 'Birinci seviye yanıt',
        parentCommentId: root.json().comment.id,
      },
    });
    const nestedReply = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: {
        body: 'İkinci seviye yanıt',
        parentCommentId: reply.json().comment.id,
      },
    });

    expect(nestedReply.statusCode).toBe(400);
  });

  it('detail response yorumları root ve replies biçiminde tek kez döndürür', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    const root = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Ana yorum' },
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: {
        body: 'Alt yanıt',
        parentCommentId: root.json().comment.id,
      },
    });
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });
    const comments = detail.json().workItem.comments as WorkItemComment[];

    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      body: 'Ana yorum',
      replies: [
        {
          body: 'Alt yanıt',
          author: {
            id: SESSION_USER.id,
            username: SESSION_USER.username,
            displayName: SESSION_USER.displayName,
          },
        },
      ],
    });
  });

  it('archive endpoint login olmayan kullanıcıyı reddeder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/archive/work-items',
    });

    expect(response.statusCode).toBe(401);
  });

  it('archive endpoint yalnız completed kayıtları döndürür', async () => {
    const active = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Aktif Ürün',
    });
    const completed = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Tamamlanan Ürün',
    });
    const completedId = completed.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${completedId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([
      completedId,
    ]);
    expect(response.body).not.toContain(active.json().workItem.id);
  });

  it('archive kayıtlarını completedAt azalan sırada döndürür', async () => {
    const first = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Önce Tamamlanan',
    });
    const second = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'Sonra Tamamlanan',
    });
    const firstId = first.json().workItem.id as string;
    const secondId = second.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${firstId}/complete`,
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${secondId}/complete`,
    });
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items',
    });

    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([
      secondId,
      firstId,
    ]);
  });

  it('archive module filtresini uygular', async () => {
    const incoming = await createWorkItem(app);
    const digital = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'digital',
      productName: 'Dijital Ürün',
    });
    const incomingId = incoming.json().workItem.id as string;
    const digitalId = digital.json().workItem.id as string;
    await repository.complete(incomingId, SESSION_USER.id);
    await repository.complete(digitalId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items?moduleKey=digital',
    });

    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([
      digitalId,
    ]);
  });

  it('archive completedBy filtresini uygular', async () => {
    const sessionItem = await createWorkItem(app);
    const secondUserItem = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'İkinci Kullanıcının İşi',
    });
    const sessionItemId = sessionItem.json().workItem.id as string;
    const secondUserItemId = secondUserItem.json().workItem.id as string;
    await repository.complete(sessionItemId, SESSION_USER.id);
    await repository.complete(secondUserItemId, SECOND_USER_ID);
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/archive/work-items?completedBy=${SECOND_USER_ID}`,
    });

    expect(response.json().items).toEqual([
      expect.objectContaining({
        id: secondUserItemId,
        completedBy: expect.objectContaining({ id: SECOND_USER_ID }),
      }),
    ]);
  });

  it('archive tamamlanma tarih aralığı filtresini uygular', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await repository.complete(workItemId, SESSION_USER.id);
    const included = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items?completedFrom=2026-09-14&completedTo=2026-09-14',
    });
    const excluded = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items?completedFrom=2026-09-15',
    });

    expect(included.json().items).toHaveLength(1);
    expect(excluded.json().items).toEqual([]);
  });

  it('archive birleşik metin aramasını desteklenen alanlarda uygular', async () => {
    const created = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      orderCode: 'BC-ARŞİV-42',
      supplierCompany: 'Özel Tedarikçi',
      productDetail: 'Mat selefonlu kutu',
    });
    const workItemId = created.json().workItem.id as string;
    await repository.complete(workItemId, SESSION_USER.id);

    for (const query of ['arşiv-42', 'özel tedarikçi', 'selefonlu']) {
      const response = await authenticatedRequest(app, {
        method: 'GET',
        url: `/api/archive/work-items?q=${encodeURIComponent(query)}`,
      });

      expect(response.json().items).toEqual([
        expect.objectContaining({ id: workItemId }),
      ]);
    }
  });

  it('archive varsayılan ve özel pagination bilgisini döndürür', async () => {
    for (let index = 0; index < 3; index += 1) {
      const created = await createWorkItem(app, {
        ...REQUIRED_CREATE_PAYLOAD,
        productName: `Arşiv Ürünü ${index}`,
      });
      await repository.complete(
        created.json().workItem.id as string,
        SESSION_USER.id,
      );
    }
    const firstPage = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items',
    });
    const secondPage = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items?page=2&pageSize=2',
    });

    expect(firstPage.json().pagination).toEqual({
      page: 1,
      pageSize: 25,
      total: 3,
      totalPages: 1,
    });
    expect(secondPage.json().items).toHaveLength(1);
    expect(secondPage.json().pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('archive suggestions duplicate değer üretmez ve yalnız completed kayıtları kullanır', async () => {
    const first = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      companyName: 'Ortak Firma',
      productName: 'Aranan Ürün',
    });
    const second = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      companyName: 'Ortak Firma',
      productName: 'Başka Ürün',
    });
    await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      companyName: 'Aranan Aktif Firma',
    });
    await repository.complete(
      first.json().workItem.id as string,
      SESSION_USER.id,
    );
    await repository.complete(
      second.json().workItem.id as string,
      SESSION_USER.id,
    );
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/archive/suggestions?q=${encodeURIComponent('Ortak')}`,
    });
    const values = response
      .json()
      .suggestions.map((suggestion: ArchiveSuggestion) => suggestion.value);

    expect(response.statusCode).toBe(200);
    expect(values).toEqual(['Ortak Firma']);
  });

  it('archive suggestions trim sonrası iki karakterden kısa sorguyu reddeder', async () => {
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/archive/suggestions?q=${encodeURIComponent('  a  ')}`,
    });

    expect(response.statusCode).toBe(400);
  });

  it('reopen sonrası iş arşivden çıkar ve son modülünde home overviewa döner', async () => {
    const created = await createWorkItem(app, {
      ...REQUIRED_CREATE_PAYLOAD,
      moduleKey: 'revisions',
    });
    const workItemId = created.json().workItem.id as string;
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/complete`,
    });
    await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/reopen`,
    });
    const archive = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items',
    });
    const home = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/home/overview',
    });
    const revisionItems = home
      .json()
      .modules.find((module: { id: string }) => module.id === 'revisions').items;

    expect(archive.json().items).toEqual([]);
    expect(revisionItems).toEqual([
      expect.objectContaining({ id: workItemId, status: 'active' }),
    ]);
  });

  it('archive yanıtları yalnız güvenli tamamlayan alanlarını döndürür', async () => {
    const created = await createWorkItem(app);
    const workItemId = created.json().workItem.id as string;
    await repository.complete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: '/api/archive/work-items',
    });
    const completedBy = response.json().items[0].completedBy;

    expect(Object.keys(completedBy).sort()).toEqual([
      'displayName',
      'id',
      'username',
    ]);
    expect(response.body.toLowerCase()).not.toMatch(/password|token|secret/);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('Phase 02D güvenli düzenleme, silme ve yorum tepkileri', () => {
  let app: FastifyInstance;
  let repository: InMemoryWorkItemRepository;

  beforeEach(() => {
    ({ app, repository } = createTestContext());
  });

  afterEach(async () => {
    await app.close();
  });

  async function createItem(
    payload: Record<string, unknown> = REQUIRED_CREATE_PAYLOAD,
  ): Promise<string> {
    const response = await createWorkItem(app, payload);
    expect(response.statusCode).toBe(201);
    return response.json().workItem.id as string;
  }

  async function addRootComment(workItemId: string, body = 'Ana yorum') {
    const response = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body },
    });
    expect(response.statusCode).toBe(201);
    return response.json().comment as { id: string };
  }

  it('yeni işlerde soft delete alanlarını null başlatır', async () => {
    const workItemId = await createItem();
    const item = repository.items.find((candidate) => candidate.id === workItemId);

    expect(item).toMatchObject({ deletedAt: null, deletedBy: null });
  });

  it('soft delete fiziksel kaydı kaldırmadan tarih ve session kullanıcısını yazar', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}`,
      payload: { confirmation: '  sil  ' },
    });
    const item = repository.items.find((candidate) => candidate.id === workItemId);

    expect(response.statusCode).toBe(204);
    expect(repository.items).toHaveLength(1);
    expect(item?.deletedAt).toBeInstanceOf(Date);
    expect(item?.deletedBy).toBe(SESSION_USER.id);
  });

  it('yanlış silme onayını exact mesajla reddeder', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}`,
      payload: { confirmation: 'silme' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'Silme onayı geçersiz.' });
    expect(repository.items[0]?.deletedAt).toBeNull();
  });

  it('tamamlanmış işi exact conflict mesajıyla silmez', async () => {
    const workItemId = await createItem();
    await repository.complete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}`,
      payload: { confirmation: 'SİL' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Tamamlanmış iş silinemez. Önce işi yeniden açın.',
    });
  });

  it('daha önce silinen işe ikinci silmede 404 döner', async () => {
    const workItemId = await createItem();
    await repository.softDelete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}`,
      payload: { confirmation: 'SİL' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('silinen işi home overview ve detail yanıtlarından çıkarır', async () => {
    const workItemId = await createItem();
    await repository.softDelete(workItemId, SESSION_USER.id);
    const [home, detail] = await Promise.all([
      authenticatedRequest(app, { method: 'GET', url: '/api/home/overview' }),
      authenticatedRequest(app, {
        method: 'GET',
        url: `/api/work-items/${workItemId}`,
      }),
    ]);

    expect(home.json().modules.flatMap((module: { items: unknown[] }) => module.items)).toEqual([]);
    expect(detail.statusCode).toBe(404);
  });

  it('silinen tamamlanmış veriyi arşiv ve önerilerden filtreler', async () => {
    const workItemId = await createItem({
      ...REQUIRED_CREATE_PAYLOAD,
      companyName: 'Silinmiş Öneri Firması',
    });
    await repository.softDelete(workItemId, SESSION_USER.id);
    const item = repository.items[0];
    if (!item) throw new Error('Test işi bulunamadı.');
    item.status = 'completed';
    item.completedAt = new Date('2026-09-15T10:00:00.000Z');
    item.completedBy = SESSION_USER.id;

    const [archive, suggestions] = await Promise.all([
      authenticatedRequest(app, {
        method: 'GET',
        url: '/api/archive/work-items',
      }),
      authenticatedRequest(app, {
        method: 'GET',
        url: '/api/archive/suggestions?q=Silinmiş',
      }),
    ]);

    expect(archive.json().items).toEqual([]);
    expect(suggestions.json().suggestions).toEqual([]);
  });

  it.each([
    ['yorum', 'POST', 'comments', { body: 'Yeni yorum' }],
    ['taşıma', 'POST', 'move', { moduleKey: 'digital' }],
    ['tamamlama', 'POST', 'complete', undefined],
    ['yeniden açma', 'POST', 'reopen', undefined],
  ] as const)('silinen işte %s aksiyonu 404 döner', async (_name, method, action, payload) => {
    const workItemId = await createItem();
    await repository.softDelete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method,
      url: `/api/work-items/${workItemId}/${action}`,
      ...(payload ? { payload } : {}),
    });

    expect(response.statusCode).toBe(404);
  });

  it('silinen işe reaction eklenmesini reddeder', async () => {
    const workItemId = await createItem();
    const comment = await addRootComment(workItemId);
    await repository.softDelete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/comments/${comment.id}/reaction`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('soft delete yorum, reaction, event ve atama kayıtlarını korur', async () => {
    const workItemId = await createItem({
      ...REQUIRED_CREATE_PAYLOAD,
      assigneeIds: [SECOND_USER_ID],
    });
    const comment = await addRootComment(workItemId);
    await repository.addCommentReaction(workItemId, comment.id, SECOND_USER_ID);
    await repository.move(workItemId, 'revisions', SESSION_USER.id);
    await repository.softDelete(workItemId, SESSION_USER.id);
    const item = repository.items[0];

    expect(item?.comments).toHaveLength(1);
    expect(item?.comments[0]?.reactionUserIds.has(SECOND_USER_ID)).toBe(true);
    expect(item?.events).toHaveLength(1);
    expect(repository.assignments.get(workItemId)).toEqual([SECOND_USER_ID]);
  });

  it('aktif işin izin verilen alanlarını ve atamalarını günceller', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: {
        companyName: '  Güncel Firma  ',
        productName: '  Güncel Ürün  ',
        processStage: '  Baskı  ',
        productDetail: '  Kutu  ',
        assigneeIds: [SECOND_USER_ID],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workItem).toMatchObject({
      companyName: 'Güncel Firma',
      title: 'Güncel Ürün',
      assignees: [expect.objectContaining({ id: SECOND_USER_ID })],
    });
    expect(repository.items[0]).toMatchObject({
      processStage: 'Baskı',
      productDetail: 'Kutu',
    });
    expect(repository.lastAssignedBy).toBe(SESSION_USER.id);
  });

  it.each([
    [{ companyName: ' ', productName: 'Ürün' }, 'Firma İsmi zorunludur.'],
    [{ companyName: 'Firma', productName: ' ' }, 'Ürün zorunludur.'],
  ])('PATCH zorunlu firma ve ürün doğrulamasını korur', async (payload, message) => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message });
  });

  it('PATCH body ile moduleKey veya durum metadata alanlarını uygulamaz', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: {
        companyName: 'Firma',
        productName: 'Ürün',
        moduleKey: 'digital',
        status: 'completed',
        createdBy: SECOND_USER_ID,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.items[0]).toMatchObject({
      moduleKey: 'incoming-orders',
      status: 'active',
      createdBy: SESSION_USER.id,
    });
  });

  it('PATCH createdBy ve createdAt alanlarını korurken updatedAt değerini yeniler', async () => {
    const workItemId = await createItem();
    const item = repository.items[0];
    if (!item) throw new Error('Test işi bulunamadı.');
    const createdBy = item.createdBy;
    const createdAt = item.createdAt;
    const previousUpdatedAt = item.updatedAt;
    await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: { companyName: 'Yeni Firma', productName: 'Yeni Ürün' },
    });

    expect(item.createdBy).toBe(createdBy);
    expect(item.createdAt).toBe(createdAt);
    expect(item.updatedAt.getTime()).toBeGreaterThan(previousUpdatedAt.getTime());
  });

  it('PATCH geçersiz veya pasif assignee değerini reddeder ve alanları değiştirmez', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: {
        companyName: 'Değişmemeli',
        productName: 'Değişmemeli',
        assigneeIds: [INACTIVE_USER_ID],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(repository.items[0]).toMatchObject({
      companyName: 'Test Firması',
      productName: 'Test Ürünü',
    });
  });

  it('tamamlanmış işi exact conflict mesajıyla düzenlemez', async () => {
    const workItemId = await createItem();
    await repository.complete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: { companyName: 'Firma', productName: 'Ürün' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Tamamlanmış iş düzenlenemez. Önce işi yeniden açın.',
    });
  });

  it('soft deleted işi düzenlemez', async () => {
    const workItemId = await createItem();
    await repository.softDelete(workItemId, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: { companyName: 'Firma', productName: 'Ürün' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH termin boşsa 10 iş günü fallback uygular', async () => {
    const workItemId = await createItem();
    await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: {
        companyName: 'Firma',
        productName: 'Ürün',
        orderPlacedDate: '2026-09-18',
        orderDeadlineDate: null,
      },
    });

    expect(repository.items[0]?.orderDeadlineDate).toBe('2026-10-02');
  });

  it('PATCH manuel termin tarihini otomatik değerle ezmez', async () => {
    const workItemId = await createItem();
    await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: {
        companyName: 'Firma',
        productName: 'Ürün',
        orderPlacedDate: '2026-09-18',
        orderDeadlineDate: '2026-12-31',
      },
    });

    expect(repository.items[0]?.orderDeadlineDate).toBe('2026-12-31');
  });

  it('PATCH güvenli summary döndürür ve secret alan sızdırmaz', async () => {
    const workItemId = await createItem();
    const response = await authenticatedRequest(app, {
      method: 'PATCH',
      url: `/api/work-items/${workItemId}`,
      payload: { companyName: 'Firma', productName: 'Ürün' },
    });

    expect(Object.keys(response.json().workItem).sort()).toEqual([
      'assignees',
      'companyName',
      'completedAt',
      'description',
      'dueDate',
      'id',
      'moduleKey',
      'status',
      'title',
    ]);
    expect(response.body.toLowerCase()).not.toMatch(/password|token|secret/);
  });

  it('ana yoruma reaction ekler ve aynı PUT isteğini idempotent tutar', async () => {
    const workItemId = await createItem();
    const comment = await addRootComment(workItemId);
    const first = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/comments/${comment.id}/reaction`,
    });
    const second = await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/comments/${comment.id}/reaction`,
    });

    expect(first.json()).toEqual({ reactionCount: 1, reactedByCurrentUser: true });
    expect(second.json()).toEqual({ reactionCount: 1, reactedByCurrentUser: true });
  });

  it('reply reaction alır ve detail count/current-user durumunu döndürür', async () => {
    const workItemId = await createItem();
    const root = await addRootComment(workItemId);
    const replyResponse = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Yanıt', parentCommentId: root.id },
    });
    const replyId = replyResponse.json().comment.id as string;
    await authenticatedRequest(app, {
      method: 'PUT',
      url: `/api/work-items/${workItemId}/comments/${replyId}/reaction`,
    });
    const detail = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });

    expect(detail.json().workItem.comments[0].replies[0]).toMatchObject({
      id: replyId,
      reactionCount: 1,
      reactedByCurrentUser: true,
    });
  });

  it('reaction kaldırırken yalnız mevcut kullanıcının kaydını kaldırır', async () => {
    const workItemId = await createItem();
    const comment = await addRootComment(workItemId);
    await repository.addCommentReaction(workItemId, comment.id, SECOND_USER_ID);
    await repository.addCommentReaction(workItemId, comment.id, SESSION_USER.id);
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}/comments/${comment.id}/reaction`,
    });

    expect(response.json()).toEqual({ reactionCount: 1, reactedByCurrentUser: false });
    const storedComment = repository.items[0]?.comments[0];
    expect(storedComment?.reactionUserIds).toEqual(new Set([SECOND_USER_ID]));
  });

  it('olmayan reaction silme isteğini idempotent tutar', async () => {
    const workItemId = await createItem();
    const comment = await addRootComment(workItemId);
    const response = await authenticatedRequest(app, {
      method: 'DELETE',
      url: `/api/work-items/${workItemId}/comments/${comment.id}/reaction`,
    });

    expect(response.json()).toEqual({ reactionCount: 0, reactedByCurrentUser: false });
  });

  it('başka işe ait veya bulunmayan yoruma reaction verilmesini reddeder', async () => {
    const firstWorkItemId = await createItem();
    const secondWorkItemId = await createItem({
      ...REQUIRED_CREATE_PAYLOAD,
      productName: 'İkinci Ürün',
    });
    const foreignComment = await addRootComment(secondWorkItemId);
    const [foreign, missing] = await Promise.all([
      authenticatedRequest(app, {
        method: 'PUT',
        url: `/api/work-items/${firstWorkItemId}/comments/${foreignComment.id}/reaction`,
      }),
      authenticatedRequest(app, {
        method: 'PUT',
        url: `/api/work-items/${firstWorkItemId}/comments/99999999-0000-4000-8000-000000000001/reaction`,
      }),
    ]);

    expect(foreign.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
  });

  it('completed işe ait ana yorum ve reply reaction alabilir', async () => {
    const workItemId = await createItem();
    const root = await addRootComment(workItemId);
    const replyResponse = await authenticatedRequest(app, {
      method: 'POST',
      url: `/api/work-items/${workItemId}/comments`,
      payload: { body: 'Yanıt', parentCommentId: root.id },
    });
    await repository.complete(workItemId, SESSION_USER.id);
    const [rootReaction, replyReaction] = await Promise.all([
      authenticatedRequest(app, {
        method: 'PUT',
        url: `/api/work-items/${workItemId}/comments/${root.id}/reaction`,
      }),
      authenticatedRequest(app, {
        method: 'PUT',
        url: `/api/work-items/${workItemId}/comments/${replyResponse.json().comment.id}/reaction`,
      }),
    ]);

    expect(rootReaction.statusCode).toBe(200);
    expect(replyReaction.statusCode).toBe(200);
  });

  it('detail bütün yorum reaction verilerini döndürür ama reaction kullanıcı listesi sızdırmaz', async () => {
    const workItemId = await createItem();
    const first = await addRootComment(workItemId, 'Birinci');
    const second = await addRootComment(workItemId, 'İkinci');
    await repository.addCommentReaction(workItemId, first.id, SECOND_USER_ID);
    await repository.addCommentReaction(workItemId, first.id, SESSION_USER.id);
    await repository.addCommentReaction(workItemId, second.id, SECOND_USER_ID);
    const response = await authenticatedRequest(app, {
      method: 'GET',
      url: `/api/work-items/${workItemId}`,
    });
    const comments = response.json().workItem.comments;

    expect(comments).toEqual([
      expect.objectContaining({ reactionCount: 2, reactedByCurrentUser: true }),
      expect.objectContaining({ reactionCount: 1, reactedByCurrentUser: false }),
    ]);
    expect(response.body).not.toContain(SECOND_USER_ID);
    expect(response.body).not.toMatch(/reactionUserIds|userIds/);
  });
});
