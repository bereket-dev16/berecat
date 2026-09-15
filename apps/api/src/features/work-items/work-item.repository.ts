import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '../../db/schema/index.js';
import {
  users,
  workItemAssignees,
  workItemCommentReactions,
  workItemComments,
  workItemEvents,
  workItems,
} from '../../db/schema/index.js';
import type { PublicUser, UserRole, UserTeam } from '../auth/auth.types.js';
import { syncWorkItemMasterData } from '../master-data/master-data.repository.js';
import type { MasterDataWorkItemValues } from '../master-data/master-data.types.js';
import {
  getWorkModuleTitle,
  isWorkModuleKey,
} from './work-item.constants.js';
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
  WorkItemCommentReply,
  WorkItemCreator,
  WorkItemDetail,
  WorkItemEvent,
  WorkItemRepository,
  WorkItemSummary,
  UpdateWorkItemResult,
} from './work-item.types.js';
import type {
  WorkItemEventType,
  WorkItemStatus,
  WorkModuleKey,
} from './work-item.constants.js';

type WorkItemDatabase = NodePgDatabase<typeof schema>;

interface WorkItemRepositoryDependencies {
  syncMasterData?: typeof syncWorkItemMasterData;
}

function toMasterDataValues(
  input: MasterDataWorkItemValues,
): MasterDataWorkItemValues {
  return {
    companyName: input.companyName,
    productName: input.productName,
    packagingType: input.packagingType,
    supplierCompany: input.supplierCompany,
    orderType: input.orderType,
    processStage: input.processStage,
  };
}

function toUserRole(value: string): UserRole {
  if (value !== 'admin' && value !== 'member') {
    throw new Error('Kullanıcı rolü geçersiz.');
  }

  return value;
}

function toUserTeam(value: string): UserTeam {
  if (value !== 'graphic' && value !== 'digital') {
    throw new Error('Kullanıcı ekibi geçersiz.');
  }

  return value;
}

function toUserOption(row: {
  id: string;
  username: string;
  displayName: string;
  role: string;
  team: string;
}): UserOption {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: toUserRole(row.role),
    team: toUserTeam(row.team),
  };
}

function toAssignee(row: {
  id: string;
  username: string;
  displayName: string;
  team: string;
}): WorkItemAssignee {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    team: toUserTeam(row.team),
  };
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toWorkItemStatus(value: string): WorkItemStatus {
  if (value !== 'active' && value !== 'completed') {
    throw new Error('İş durumu geçersiz.');
  }

  return value;
}

function toWorkItemEventType(value: string): WorkItemEventType {
  if (value !== 'moved' && value !== 'completed' && value !== 'reopened') {
    throw new Error('İş etkinliği türü geçersiz.');
  }

  return value;
}

function toNullableModuleKey(value: string | null): WorkModuleKey | null {
  if (value === null) {
    return null;
  }

  if (!isWorkModuleKey(value)) {
    throw new Error('İş modülü geçersiz.');
  }

  return value;
}

function toUtcDateStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toUtcNextDateStart(value: string): Date {
  const date = toUtcDateStart(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function buildArchiveConditions(
  query: NormalizedArchiveWorkItemsQuery,
): SQL[] {
  const conditions: SQL[] = [
    eq(workItems.status, 'completed'),
    isNull(workItems.deletedAt),
  ];

  if (query.q) {
    const searchPattern = `%${query.q}%`;
    const searchCondition = or(
      ilike(workItems.orderCode, searchPattern),
      ilike(workItems.companyName, searchPattern),
      ilike(workItems.productName, searchPattern),
      ilike(workItems.supplierCompany, searchPattern),
      ilike(workItems.packagingType, searchPattern),
      ilike(workItems.orderType, searchPattern),
      ilike(workItems.productDetail, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (query.moduleKey) {
    conditions.push(eq(workItems.moduleKey, query.moduleKey));
  }

  if (query.completedBy) {
    conditions.push(eq(workItems.completedBy, query.completedBy));
  }

  if (query.completedFrom) {
    conditions.push(
      gte(workItems.completedAt, toUtcDateStart(query.completedFrom)),
    );
  }

  if (query.completedTo) {
    conditions.push(
      lt(workItems.completedAt, toUtcNextDateStart(query.completedTo)),
    );
  }

  return conditions;
}

export function createWorkItemRepository(
  database: WorkItemDatabase,
  dependencies: WorkItemRepositoryDependencies = {},
): WorkItemRepository {
  const syncMasterData =
    dependencies.syncMasterData ?? syncWorkItemMasterData;
  async function listAssignees(workItemId: string): Promise<WorkItemAssignee[]> {
    const rows = await database
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        team: users.team,
      })
      .from(workItemAssignees)
      .innerJoin(users, eq(workItemAssignees.userId, users.id))
      .where(eq(workItemAssignees.workItemId, workItemId))
      .orderBy(asc(users.displayName), asc(users.username));

    return rows.map(toAssignee);
  }

  async function findSummary(workItemId: string): Promise<WorkItemSummary | null> {
    const [row] = await database
      .select({
        id: workItems.id,
        moduleKey: workItems.moduleKey,
        productName: workItems.productName,
        companyName: workItems.companyName,
        productDetail: workItems.productDetail,
        orderDeadlineDate: workItems.orderDeadlineDate,
        status: workItems.status,
        completedAt: workItems.completedAt,
      })
      .from(workItems)
      .where(
        and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    if (!isWorkModuleKey(row.moduleKey)) {
      throw new Error('İş modülü geçersiz.');
    }

    return {
      id: row.id,
      moduleKey: row.moduleKey,
      title: row.productName,
      companyName: row.companyName,
      description: row.productDetail,
      dueDate: row.orderDeadlineDate,
      status: toWorkItemStatus(row.status),
      completedAt: row.completedAt ? toIsoString(row.completedAt) : null,
      assignees: await listAssignees(row.id),
    };
  }

  async function findCreator(userId: string | null): Promise<WorkItemCreator | null> {
    if (!userId) {
      return null;
    }

    const [row] = await database
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row ?? null;
  }

  async function changeCommentReaction(
    action: 'add' | 'remove',
    workItemId: string,
    commentId: string,
    userId: string,
  ): Promise<ChangeCommentReactionResult> {
    return database.transaction(async (tx) => {
      const [workItem] = await tx
        .select({ id: workItems.id })
        .from(workItems)
        .where(
          and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
        )
        .limit(1)
        .for('share');

      if (!workItem) {
        return { status: 'not-found' as const };
      }

      const [comment] = await tx
        .select({ id: workItemComments.id })
        .from(workItemComments)
        .where(
          and(
            eq(workItemComments.id, commentId),
            eq(workItemComments.workItemId, workItemId),
          ),
        )
        .limit(1);

      if (!comment) {
        return { status: 'comment-not-found' as const };
      }

      if (action === 'add') {
        await tx
          .insert(workItemCommentReactions)
          .values({ commentId, userId })
          .onConflictDoNothing({
            target: [
              workItemCommentReactions.commentId,
              workItemCommentReactions.userId,
            ],
          });
      } else {
        await tx
          .delete(workItemCommentReactions)
          .where(
            and(
              eq(workItemCommentReactions.commentId, commentId),
              eq(workItemCommentReactions.userId, userId),
            ),
          );
      }

      const [reactionTotal] = await tx
        .select({ total: count() })
        .from(workItemCommentReactions)
        .where(eq(workItemCommentReactions.commentId, commentId));

      return {
        status: 'updated' as const,
        reaction: {
          reactionCount: reactionTotal?.total ?? 0,
          reactedByCurrentUser: action === 'add',
        },
      };
    });
  }

  return {
    async listActiveUserOptions(): Promise<UserOption[]> {
      const rows = await database
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          team: users.team,
        })
        .from(users)
        .where(eq(users.isActive, true))
        .orderBy(asc(users.displayName), asc(users.username));

      return rows.map(toUserOption);
    },

    async listHomeItems(): Promise<StoredHomeItem[]> {
      const rows = await database
        .select({
          id: workItems.id,
          moduleKey: workItems.moduleKey,
          productName: workItems.productName,
          companyName: workItems.companyName,
          productDetail: workItems.productDetail,
          orderDeadlineDate: workItems.orderDeadlineDate,
          status: workItems.status,
          completedAt: workItems.completedAt,
          createdAt: workItems.createdAt,
          assigneeId: users.id,
          assigneeDisplayName: users.displayName,
        })
        .from(workItems)
        .leftJoin(
          workItemAssignees,
          eq(workItemAssignees.workItemId, workItems.id),
        )
        .leftJoin(
          users,
          and(
            eq(users.id, workItemAssignees.userId),
            eq(users.isActive, true),
          ),
        )
        .where(
          and(
            eq(workItems.status, 'active'),
            isNull(workItems.deletedAt),
          ),
        )
        .orderBy(
          desc(workItems.createdAt),
          desc(workItems.id),
          asc(users.displayName),
        );

      const items = new Map<string, StoredHomeItem>();

      for (const row of rows) {
        if (!isWorkModuleKey(row.moduleKey)) {
          throw new Error('İş modülü geçersiz.');
        }

        let item = items.get(row.id);

        if (!item) {
          item = {
            id: row.id,
            moduleKey: row.moduleKey,
            title: row.productName,
            companyName: row.companyName,
            description: row.productDetail,
            dueDate: row.orderDeadlineDate,
            status: toWorkItemStatus(row.status),
            completedAt: row.completedAt
              ? toIsoString(row.completedAt)
              : null,
            assignees: [],
          };
          items.set(row.id, item);
        }

        if (row.assigneeId && row.assigneeDisplayName) {
          item.assignees.push({
            id: row.assigneeId,
            displayName: row.assigneeDisplayName,
          });
        }
      }

      return [...items.values()];
    },

    async createWithAssignees(
      input: NormalizedCreateWorkItemInput,
      createdBy: string,
    ): Promise<CreateWorkItemResult> {
      const transactionResult = await database.transaction(async (tx) => {
        if (input.assigneeIds.length > 0) {
          const activeUsers = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                inArray(users.id, input.assigneeIds),
                eq(users.isActive, true),
              ),
            );

          if (activeUsers.length !== input.assigneeIds.length) {
            return { status: 'invalid-assignees' as const };
          }
        }

        const { assigneeIds, ...workItemValues } = input;
        const [createdWorkItem] = await tx
          .insert(workItems)
          .values({ ...workItemValues, createdBy })
          .returning({
            id: workItems.id,
            moduleKey: workItems.moduleKey,
            productName: workItems.productName,
            companyName: workItems.companyName,
            productDetail: workItems.productDetail,
            orderDeadlineDate: workItems.orderDeadlineDate,
            status: workItems.status,
            completedAt: workItems.completedAt,
          });

        if (!createdWorkItem) {
          throw new Error('İş kaydı oluşturulamadı.');
        }

        if (assigneeIds.length > 0) {
          await tx.insert(workItemAssignees).values(
            assigneeIds.map((userId) => ({
              workItemId: createdWorkItem.id,
              userId,
              assignedBy: createdBy,
            })),
          );
        }

        await syncMasterData(tx, toMasterDataValues(input));

        return { status: 'created' as const, workItem: createdWorkItem };
      });

      if (transactionResult.status === 'invalid-assignees') {
        return transactionResult;
      }

      const createdWorkItem = transactionResult.workItem;

      if (!isWorkModuleKey(createdWorkItem.moduleKey)) {
        throw new Error('İş modülü geçersiz.');
      }

      return {
        status: 'created',
        workItem: {
          id: createdWorkItem.id,
          moduleKey: createdWorkItem.moduleKey,
          title: createdWorkItem.productName,
          companyName: createdWorkItem.companyName,
          description: createdWorkItem.productDetail,
          dueDate: createdWorkItem.orderDeadlineDate,
          status: toWorkItemStatus(createdWorkItem.status),
          completedAt: createdWorkItem.completedAt
            ? toIsoString(createdWorkItem.completedAt)
            : null,
          assignees: await listAssignees(createdWorkItem.id),
        },
      };
    },

    async findDetail(
      workItemId: string,
      currentUserId: string,
    ): Promise<WorkItemDetail | null> {
      const [row] = await database
        .select({
          id: workItems.id,
          moduleKey: workItems.moduleKey,
          orderCode: workItems.orderCode,
          companyName: workItems.companyName,
          productName: workItems.productName,
          packagingType: workItems.packagingType,
          supplierCompany: workItems.supplierCompany,
          orderType: workItems.orderType,
          stockValue: workItems.stockValue,
          needOrderValue: workItems.needOrderValue,
          orderedQuantity: workItems.orderedQuantity,
          receivedQuantity: workItems.receivedQuantity,
          orderReceivedDate: workItems.orderReceivedDate,
          orderPlacedDate: workItems.orderPlacedDate,
          orderDeadlineDate: workItems.orderDeadlineDate,
          orderShipmentDate: workItems.orderShipmentDate,
          processStage: workItems.processStage,
          productDetail: workItems.productDetail,
          status: workItems.status,
          completedAt: workItems.completedAt,
          completedBy: workItems.completedBy,
          createdAt: workItems.createdAt,
          updatedAt: workItems.updatedAt,
          creatorId: users.id,
          creatorUsername: users.username,
          creatorDisplayName: users.displayName,
        })
        .from(workItems)
        .innerJoin(users, eq(workItems.createdBy, users.id))
        .where(
          and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
        )
        .limit(1);

      if (!row) {
        return null;
      }

      if (!isWorkModuleKey(row.moduleKey)) {
        throw new Error('İş modülü geçersiz.');
      }

      const [
        assignees,
        commentRows,
        reactionRows,
        completedBy,
        eventRows,
      ] = await Promise.all([
        listAssignees(workItemId),
        database
          .select({
            id: workItemComments.id,
            body: workItemComments.body,
            parentCommentId: workItemComments.parentCommentId,
            createdAt: workItemComments.createdAt,
            authorId: users.id,
            authorUsername: users.username,
            authorDisplayName: users.displayName,
          })
          .from(workItemComments)
          .innerJoin(users, eq(workItemComments.authorId, users.id))
          .where(eq(workItemComments.workItemId, workItemId))
          .orderBy(
            asc(workItemComments.createdAt),
            asc(workItemComments.id),
          ),
        database
          .select({
            commentId: workItemCommentReactions.commentId,
            userId: workItemCommentReactions.userId,
          })
          .from(workItemCommentReactions)
          .innerJoin(
            workItemComments,
            eq(workItemCommentReactions.commentId, workItemComments.id),
          )
          .where(eq(workItemComments.workItemId, workItemId)),
        findCreator(row.completedBy),
        database
          .select({
            id: workItemEvents.id,
            eventType: workItemEvents.eventType,
            createdAt: workItemEvents.createdAt,
            actorId: users.id,
            actorUsername: users.username,
            actorDisplayName: users.displayName,
            fromModuleKey: workItemEvents.fromModuleKey,
            toModuleKey: workItemEvents.toModuleKey,
          })
          .from(workItemEvents)
          .innerJoin(users, eq(workItemEvents.actorId, users.id))
          .where(eq(workItemEvents.workItemId, workItemId))
          .orderBy(asc(workItemEvents.createdAt), asc(workItemEvents.id)),
      ]);

      const reactionsByComment = new Map<
        string,
        { reactionCount: number; reactedByCurrentUser: boolean }
      >();

      for (const reaction of reactionRows) {
        const current = reactionsByComment.get(reaction.commentId) ?? {
          reactionCount: 0,
          reactedByCurrentUser: false,
        };
        current.reactionCount += 1;
        current.reactedByCurrentUser ||= reaction.userId === currentUserId;
        reactionsByComment.set(reaction.commentId, current);
      }

      function getReactionState(commentId: string) {
        return (
          reactionsByComment.get(commentId) ?? {
            reactionCount: 0,
            reactedByCurrentUser: false,
          }
        );
      }

      const rootComments = new Map<string, WorkItemComment>();

      for (const comment of commentRows) {
        if (comment.parentCommentId !== null) {
          continue;
        }

        rootComments.set(comment.id, {
          id: comment.id,
          body: comment.body,
          createdAt: toIsoString(comment.createdAt),
          author: {
            id: comment.authorId,
            username: comment.authorUsername,
            displayName: comment.authorDisplayName,
          },
          ...getReactionState(comment.id),
          replies: [],
        });
      }

      for (const comment of commentRows) {
        if (comment.parentCommentId === null) {
          continue;
        }

        const parentComment = rootComments.get(comment.parentCommentId);

        if (!parentComment) {
          throw new Error('Yorum hiyerarşisi geçersiz.');
        }

        const reply: WorkItemCommentReply = {
          id: comment.id,
          body: comment.body,
          createdAt: toIsoString(comment.createdAt),
          author: {
            id: comment.authorId,
            username: comment.authorUsername,
            displayName: comment.authorDisplayName,
          },
          ...getReactionState(comment.id),
        };
        parentComment.replies.push(reply);
      }

      const comments = [...rootComments.values()];

      const events: WorkItemEvent[] = eventRows.map((event) => {
        const fromModuleKey = toNullableModuleKey(event.fromModuleKey);
        const toModuleKey = toNullableModuleKey(event.toModuleKey);

        return {
          id: event.id,
          type: toWorkItemEventType(event.eventType),
          createdAt: toIsoString(event.createdAt),
          actor: {
            id: event.actorId,
            username: event.actorUsername,
            displayName: event.actorDisplayName,
          },
          fromModuleKey,
          fromModuleTitle: fromModuleKey
            ? getWorkModuleTitle(fromModuleKey)
            : null,
          toModuleKey,
          toModuleTitle: toModuleKey ? getWorkModuleTitle(toModuleKey) : null,
        };
      });

      return {
        id: row.id,
        moduleKey: row.moduleKey,
        moduleTitle: getWorkModuleTitle(row.moduleKey),
        orderCode: row.orderCode,
        companyName: row.companyName,
        productName: row.productName,
        packagingType: row.packagingType,
        supplierCompany: row.supplierCompany,
        orderType: row.orderType,
        stockValue: row.stockValue,
        needOrderValue: row.needOrderValue,
        orderedQuantity: row.orderedQuantity,
        receivedQuantity: row.receivedQuantity,
        orderReceivedDate: row.orderReceivedDate,
        orderPlacedDate: row.orderPlacedDate,
        orderDeadlineDate: row.orderDeadlineDate,
        orderShipmentDate: row.orderShipmentDate,
        processStage: row.processStage,
        productDetail: row.productDetail,
        status: toWorkItemStatus(row.status),
        completedAt: row.completedAt ? toIsoString(row.completedAt) : null,
        completedBy,
        assignees,
        createdBy: {
          id: row.creatorId,
          username: row.creatorUsername,
          displayName: row.creatorDisplayName,
        },
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
        comments,
        events,
      };
    },

    async updateWithAssignees(
      workItemId: string,
      input: NormalizedUpdateWorkItemInput,
      updatedBy: string,
    ): Promise<UpdateWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({
            id: workItems.id,
            status: workItems.status,
            companyName: workItems.companyName,
            productName: workItems.productName,
            packagingType: workItems.packagingType,
            supplierCompany: workItems.supplierCompany,
            orderType: workItems.orderType,
            processStage: workItems.processStage,
          })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        if (input.assigneeIds.length > 0) {
          const activeUsers = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                inArray(users.id, input.assigneeIds),
                eq(users.isActive, true),
              ),
            );

          if (activeUsers.length !== input.assigneeIds.length) {
            return 'invalid-assignees' as const;
          }
        }

        const { assigneeIds, ...workItemValues } = input;
        const now = new Date();

        await tx
          .update(workItems)
          .set({ ...workItemValues, updatedAt: now })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        await tx
          .delete(workItemAssignees)
          .where(eq(workItemAssignees.workItemId, workItemId));

        if (assigneeIds.length > 0) {
          await tx.insert(workItemAssignees).values(
            assigneeIds.map((userId) => ({
              workItemId,
              userId,
              assignedBy: updatedBy,
              assignedAt: now,
            })),
          );
        }

        await syncMasterData(
          tx,
          toMasterDataValues(input),
          toMasterDataValues(workItem),
        );

        return 'updated' as const;
      });

      if (status !== 'updated') {
        return { status };
      }

      const workItem = await findSummary(workItemId);

      if (!workItem) {
        throw new Error('Düzenlenen iş bulunamadı.');
      }

      return { status: 'updated', workItem };
    },

    async softDelete(
      workItemId: string,
      deletedBy: string,
    ): Promise<DeleteWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({ id: workItems.id, status: workItems.status })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        const now = new Date();
        await tx
          .update(workItems)
          .set({ deletedAt: now, deletedBy, updatedAt: now })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        return 'deleted' as const;
      });

      return { status };
    },

    async replaceAssignees(
      workItemId: string,
      userIds: string[],
      assignedBy: string,
    ): Promise<ReplaceAssigneesResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({ id: workItems.id, status: workItems.status })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        if (userIds.length > 0) {
          const activeUsers = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(inArray(users.id, userIds), eq(users.isActive, true)),
            );

          if (activeUsers.length !== userIds.length) {
            return 'invalid-assignees' as const;
          }
        }

        await tx
          .delete(workItemAssignees)
          .where(eq(workItemAssignees.workItemId, workItemId));

        if (userIds.length > 0) {
          await tx.insert(workItemAssignees).values(
            userIds.map((userId) => ({
              workItemId,
              userId,
              assignedBy,
            })),
          );
        }

        await tx
          .update(workItems)
          .set({ updatedAt: new Date() })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        return 'updated' as const;
      });

      if (status !== 'updated') {
        return { status };
      }

      return { status: 'updated', assignees: await listAssignees(workItemId) };
    },

    async claim(
      workItemId: string,
      user: PublicUser,
    ): Promise<ClaimWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({
            id: workItems.id,
            moduleKey: workItems.moduleKey,
            status: workItems.status,
          })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        if (workItem.moduleKey !== 'incoming-orders') {
          return 'wrong-module' as const;
        }

        const currentAssignments = await tx
          .select({ userId: workItemAssignees.userId })
          .from(workItemAssignees)
          .where(eq(workItemAssignees.workItemId, workItemId));

        if (currentAssignments.some((assignment) => assignment.userId === user.id)) {
          return 'claimed' as const;
        }

        if (currentAssignments.length > 0) {
          return 'conflict' as const;
        }

        await tx.insert(workItemAssignees).values({
          workItemId,
          userId: user.id,
          assignedBy: user.id,
        });

        await tx
          .update(workItems)
          .set({ updatedAt: new Date() })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        return 'claimed' as const;
      });

      if (status !== 'claimed') {
        return { status };
      }

      return { status: 'claimed', assignees: await listAssignees(workItemId) };
    },

    async move(
      workItemId: string,
      moduleKey: WorkModuleKey,
      actorId: string,
    ): Promise<MoveWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({
            id: workItems.id,
            moduleKey: workItems.moduleKey,
            status: workItems.status,
          })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        if (!isWorkModuleKey(workItem.moduleKey)) {
          throw new Error('İş modülü geçersiz.');
        }

        if (workItem.moduleKey === moduleKey) {
          return 'same-module' as const;
        }

        const now = new Date();
        await tx
          .update(workItems)
          .set({ moduleKey, updatedAt: now })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        await tx.insert(workItemEvents).values({
          workItemId,
          actorId,
          eventType: 'moved',
          fromModuleKey: workItem.moduleKey,
          toModuleKey: moduleKey,
          createdAt: now,
        });

        return 'moved' as const;
      });

      if (status !== 'moved') {
        return { status };
      }

      const workItem = await findSummary(workItemId);
      if (!workItem) {
        throw new Error('Aktarılan iş bulunamadı.');
      }

      return { status: 'moved', workItem };
    },

    async complete(
      workItemId: string,
      actorId: string,
    ): Promise<CompleteWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({ id: workItems.id, status: workItems.status })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'completed') {
          return 'completed' as const;
        }

        const now = new Date();
        await tx
          .update(workItems)
          .set({
            status: 'completed',
            completedAt: now,
            completedBy: actorId,
            updatedAt: now,
          })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        await tx.insert(workItemEvents).values({
          workItemId,
          actorId,
          eventType: 'completed',
          createdAt: now,
        });

        return 'completed' as const;
      });

      if (status === 'not-found') {
        return { status };
      }

      const workItem = await findSummary(workItemId);
      if (!workItem) {
        throw new Error('Tamamlanan iş bulunamadı.');
      }

      return { status: 'completed', workItem };
    },

    async reopen(
      workItemId: string,
      actorId: string,
    ): Promise<ReopenWorkItemResult> {
      const status = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({ id: workItems.id, status: workItems.status })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('update');

        if (!workItem) {
          return 'not-found' as const;
        }

        if (workItem.status === 'active') {
          return 'reopened' as const;
        }

        const now = new Date();
        await tx
          .update(workItems)
          .set({
            status: 'active',
            completedAt: null,
            completedBy: null,
            updatedAt: now,
          })
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          );

        await tx.insert(workItemEvents).values({
          workItemId,
          actorId,
          eventType: 'reopened',
          createdAt: now,
        });

        return 'reopened' as const;
      });

      if (status === 'not-found') {
        return { status };
      }

      const workItem = await findSummary(workItemId);
      if (!workItem) {
        throw new Error('Yeniden açılan iş bulunamadı.');
      }

      return { status: 'reopened', workItem };
    },

    async addComment(
      workItemId: string,
      body: string,
      parentCommentId: string | null,
      author: PublicUser,
    ): Promise<AddCommentResult> {
      const result = await database.transaction(async (tx) => {
        const [workItem] = await tx
          .select({ id: workItems.id })
          .from(workItems)
          .where(
            and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)),
          )
          .limit(1)
          .for('share');

        if (!workItem) {
          return { status: 'not-found' as const };
        }

        if (parentCommentId) {
          const [parentComment] = await tx
            .select({
              id: workItemComments.id,
              workItemId: workItemComments.workItemId,
              parentCommentId: workItemComments.parentCommentId,
            })
            .from(workItemComments)
            .where(eq(workItemComments.id, parentCommentId))
            .limit(1);

          if (!parentComment) {
            return { status: 'parent-not-found' as const };
          }

          if (parentComment.workItemId !== workItemId) {
            return { status: 'parent-work-item-mismatch' as const };
          }

          if (parentComment.parentCommentId !== null) {
            return { status: 'nested-reply' as const };
          }
        }

        const [comment] = await tx
          .insert(workItemComments)
          .values({
            workItemId,
            body,
            authorId: author.id,
            parentCommentId,
          })
          .returning({
            id: workItemComments.id,
            body: workItemComments.body,
            parentCommentId: workItemComments.parentCommentId,
            createdAt: workItemComments.createdAt,
          });

        if (!comment) {
          throw new Error('Yorum kaydı oluşturulamadı.');
        }

        return { status: 'created' as const, comment };
      });

      if (result.status !== 'created') {
        return result;
      }

      return {
        status: 'created',
        comment: {
          id: result.comment.id,
          body: result.comment.body,
          parentCommentId: result.comment.parentCommentId,
          createdAt: toIsoString(result.comment.createdAt),
          author: {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
          },
          reactionCount: 0,
          reactedByCurrentUser: false,
        },
      };
    },

    async addCommentReaction(
      workItemId: string,
      commentId: string,
      userId: string,
    ): Promise<ChangeCommentReactionResult> {
      return changeCommentReaction('add', workItemId, commentId, userId);
    },

    async removeCommentReaction(
      workItemId: string,
      commentId: string,
      userId: string,
    ): Promise<ChangeCommentReactionResult> {
      return changeCommentReaction('remove', workItemId, commentId, userId);
    },

    async listArchiveWorkItems(
      query: NormalizedArchiveWorkItemsQuery,
    ): Promise<ArchiveWorkItemList> {
      const conditions = buildArchiveConditions(query);
      const whereCondition = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        database
          .select({
            id: workItems.id,
            orderCode: workItems.orderCode,
            companyName: workItems.companyName,
            productName: workItems.productName,
            packagingType: workItems.packagingType,
            orderType: workItems.orderType,
            orderedQuantity: workItems.orderedQuantity,
            moduleKey: workItems.moduleKey,
            completedAt: workItems.completedAt,
            completedById: users.id,
            completedByUsername: users.username,
            completedByDisplayName: users.displayName,
          })
          .from(workItems)
          .innerJoin(users, eq(workItems.completedBy, users.id))
          .where(whereCondition)
          .orderBy(desc(workItems.completedAt), desc(workItems.id))
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
        database
          .select({ total: count() })
          .from(workItems)
          .where(whereCondition),
      ]);

      const total = totalRows[0]?.total ?? 0;

      return {
        items: rows.map((row) => {
          if (!isWorkModuleKey(row.moduleKey)) {
            throw new Error('İş modülü geçersiz.');
          }

          if (!row.completedAt) {
            throw new Error('Arşiv kaydının tamamlanma tarihi bulunamadı.');
          }

          return {
            id: row.id,
            orderCode: row.orderCode,
            companyName: row.companyName,
            productName: row.productName,
            packagingType: row.packagingType,
            orderType: row.orderType,
            orderedQuantity: row.orderedQuantity,
            moduleKey: row.moduleKey,
            moduleTitle: getWorkModuleTitle(row.moduleKey),
            completedAt: toIsoString(row.completedAt),
            completedBy: {
              id: row.completedById,
              username: row.completedByUsername,
              displayName: row.completedByDisplayName,
            },
          };
        }),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    },

    async listArchiveSuggestions(query: string): Promise<ArchiveSuggestion[]> {
      const searchPattern = `%${query}%`;
      const [companyRows, productRows, orderCodeRows] = await Promise.all([
        database
          .select({ value: workItems.companyName })
          .from(workItems)
          .where(
            and(
              eq(workItems.status, 'completed'),
              isNull(workItems.deletedAt),
              ilike(workItems.companyName, searchPattern),
            ),
          )
          .groupBy(workItems.companyName)
          .orderBy(asc(workItems.companyName))
          .limit(10),
        database
          .select({ value: workItems.productName })
          .from(workItems)
          .where(
            and(
              eq(workItems.status, 'completed'),
              isNull(workItems.deletedAt),
              ilike(workItems.productName, searchPattern),
            ),
          )
          .groupBy(workItems.productName)
          .orderBy(asc(workItems.productName))
          .limit(10),
        database
          .select({ value: workItems.orderCode })
          .from(workItems)
          .where(
            and(
              eq(workItems.status, 'completed'),
              isNull(workItems.deletedAt),
              isNotNull(workItems.orderCode),
              ilike(workItems.orderCode, searchPattern),
            ),
          )
          .groupBy(workItems.orderCode)
          .orderBy(asc(workItems.orderCode))
          .limit(10),
      ]);
      const candidates: ArchiveSuggestion[] = [
        ...companyRows.map((row) => ({
          type: 'company' as const,
          value: row.value,
        })),
        ...productRows.map((row) => ({
          type: 'product' as const,
          value: row.value,
        })),
        ...orderCodeRows.flatMap((row) =>
          row.value
            ? [{ type: 'orderCode' as const, value: row.value }]
            : [],
        ),
      ];
      const seenValues = new Set<string>();

      return candidates.filter((suggestion) => {
        const normalizedValue = suggestion.value.toLocaleLowerCase('tr-TR');

        if (seenValues.has(normalizedValue)) {
          return false;
        }

        seenValues.add(normalizedValue);
        return true;
      }).slice(0, 10);
    },
  };
}
