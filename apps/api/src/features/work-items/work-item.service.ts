import {
  CLAIM_CONFLICT_MESSAGE,
  COMPLETED_ASSIGNMENT_MESSAGE,
  COMPLETED_CLAIM_MESSAGE,
  COMPLETED_DELETE_MESSAGE,
  COMPLETED_MOVE_MESSAGE,
  COMPLETED_UPDATE_MESSAGE,
  DUPLICATE_ASSIGNEE_MESSAGE,
  INVALID_DELETE_CONFIRMATION_MESSAGE,
  INVALID_ASSIGNEE_MESSAGE,
  SAME_MODULE_MESSAGE,
  WRONG_CLAIM_MODULE_MESSAGE,
  isWorkModuleKey,
} from './work-item.constants.js';
import type { WorkModuleKey } from './work-item.constants.js';
import { addBusinessDays } from './business-days.js';
import type {
  ArchiveWorkItemsQueryInput,
  CreateWorkItemInput,
  NormalizedArchiveWorkItemsQuery,
  NormalizedCreateWorkItemInput,
  NormalizedUpdateWorkItemInput,
  UpdateWorkItemInput,
  WorkItemRepository,
  WorkItemService,
  WorkItemServiceResult,
} from './work-item.types.js';

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeUserIds(userIds: string[]): string[] | null {
  const normalized = userIds.map((userId) => userId.toLowerCase());
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function normalizeUpdateInput(
  input: UpdateWorkItemInput,
): WorkItemServiceResult<NormalizedUpdateWorkItemInput> {
  const companyName = input.companyName.trim();
  const productName = input.productName.trim();

  if (!companyName) {
    return { status: 'invalid', message: 'Firma İsmi zorunludur.' };
  }

  if (!productName) {
    return { status: 'invalid', message: 'Ürün zorunludur.' };
  }

  const assigneeIds = normalizeUserIds(input.assigneeIds ?? []);

  if (!assigneeIds) {
    return { status: 'invalid', message: DUPLICATE_ASSIGNEE_MESSAGE };
  }

  const orderPlacedDate = normalizeOptionalText(input.orderPlacedDate);
  let orderDeadlineDate = normalizeOptionalText(input.orderDeadlineDate);

  if (orderPlacedDate && !orderDeadlineDate) {
    try {
      orderDeadlineDate = addBusinessDays(orderPlacedDate, 10);
    } catch {
      return {
        status: 'invalid',
        message: 'Sipariş Verilen Tarih geçersiz.',
      };
    }
  }

  return {
    status: 'success',
    value: {
      orderCode: normalizeOptionalText(input.orderCode),
      companyName,
      productName,
      packagingType: normalizeOptionalText(input.packagingType),
      supplierCompany: normalizeOptionalText(input.supplierCompany),
      orderType: normalizeOptionalText(input.orderType),
      stockValue: normalizeOptionalText(input.stockValue),
      needOrderValue: normalizeOptionalText(input.needOrderValue),
      orderedQuantity: normalizeOptionalText(input.orderedQuantity),
      receivedQuantity: normalizeOptionalText(input.receivedQuantity),
      orderReceivedDate: normalizeOptionalText(input.orderReceivedDate),
      orderPlacedDate,
      orderDeadlineDate,
      orderShipmentDate: normalizeOptionalText(input.orderShipmentDate),
      processStage: normalizeOptionalText(input.processStage),
      productDetail: normalizeOptionalText(input.productDetail),
      assigneeIds,
    },
  };
}

function normalizeCreateInput(
  input: CreateWorkItemInput,
): WorkItemServiceResult<NormalizedCreateWorkItemInput> {
  if (!isWorkModuleKey(input.moduleKey)) {
    return { status: 'invalid', message: 'İş modülü geçersiz.' };
  }

  const normalized = normalizeUpdateInput(input);

  if (normalized.status !== 'success') {
    return normalized;
  }

  return {
    status: 'success',
    value: { moduleKey: input.moduleKey, ...normalized.value },
  };
}

function normalizeArchiveQuery(
  input: ArchiveWorkItemsQueryInput,
): WorkItemServiceResult<NormalizedArchiveWorkItemsQuery> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;

  if (!Number.isInteger(page) || page < 1) {
    return { status: 'invalid', message: 'Sayfa değeri geçersiz.' };
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { status: 'invalid', message: 'Sayfa boyutu geçersiz.' };
  }

  let moduleKey: WorkModuleKey | null = null;

  if (input.moduleKey) {
    if (!isWorkModuleKey(input.moduleKey)) {
      return { status: 'invalid', message: 'İş modülü geçersiz.' };
    }

    moduleKey = input.moduleKey;
  }

  const completedFrom = normalizeOptionalText(input.completedFrom);
  const completedTo = normalizeOptionalText(input.completedTo);

  if (completedFrom && completedTo && completedFrom > completedTo) {
    return {
      status: 'invalid',
      message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    };
  }

  return {
    status: 'success',
    value: {
      q: normalizeOptionalText(input.q),
      moduleKey,
      completedBy:
        normalizeOptionalText(input.completedBy)?.toLowerCase() ?? null,
      completedFrom,
      completedTo,
      page,
      pageSize,
    },
  };
}

export function createWorkItemService(
  repository: WorkItemRepository,
): WorkItemService {
  return {
    async listUserOptions() {
      return repository.listActiveUserOptions();
    },

    async createWorkItem(input, user) {
      const normalized = normalizeCreateInput(input);

      if (normalized.status !== 'success') {
        return normalized;
      }

      const result = await repository.createWithAssignees(
        normalized.value,
        user.id,
      );

      if (result.status === 'invalid-assignees') {
        return { status: 'invalid', message: INVALID_ASSIGNEE_MESSAGE };
      }

      return { status: 'success', value: result.workItem };
    },

    async getWorkItem(workItemId, user) {
      const workItem = await repository.findDetail(workItemId, user.id);

      if (!workItem) {
        return { status: 'not-found' };
      }

      return { status: 'success', value: workItem };
    },

    async updateWorkItem(workItemId, input, user) {
      const normalized = normalizeUpdateInput(input);

      if (normalized.status !== 'success') {
        return normalized;
      }

      const result = await repository.updateWithAssignees(
        workItemId,
        normalized.value,
        user.id,
      );

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'completed') {
        return { status: 'conflict', message: COMPLETED_UPDATE_MESSAGE };
      }

      if (result.status === 'invalid-assignees') {
        return { status: 'invalid', message: INVALID_ASSIGNEE_MESSAGE };
      }

      return { status: 'success', value: result.workItem };
    },

    async deleteWorkItem(workItemId, confirmation, user) {
      if (confirmation.trim().toLocaleUpperCase('tr-TR') !== 'SİL') {
        return {
          status: 'invalid',
          message: INVALID_DELETE_CONFIRMATION_MESSAGE,
        };
      }

      const result = await repository.softDelete(workItemId, user.id);

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'completed') {
        return { status: 'conflict', message: COMPLETED_DELETE_MESSAGE };
      }

      return { status: 'success', value: undefined };
    },

    async replaceAssignees(workItemId, userIds, user) {
      const normalizedUserIds = normalizeUserIds(userIds);

      if (!normalizedUserIds) {
        return { status: 'invalid', message: DUPLICATE_ASSIGNEE_MESSAGE };
      }

      const result = await repository.replaceAssignees(
        workItemId,
        normalizedUserIds,
        user.id,
      );

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'invalid-assignees') {
        return { status: 'invalid', message: INVALID_ASSIGNEE_MESSAGE };
      }

      if (result.status === 'completed') {
        return { status: 'conflict', message: COMPLETED_ASSIGNMENT_MESSAGE };
      }

      return { status: 'success', value: result.assignees };
    },

    async claimWorkItem(workItemId, user) {
      const result = await repository.claim(workItemId, user);

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'wrong-module') {
        return { status: 'invalid', message: WRONG_CLAIM_MODULE_MESSAGE };
      }

      if (result.status === 'conflict') {
        return { status: 'conflict', message: CLAIM_CONFLICT_MESSAGE };
      }

      if (result.status === 'completed') {
        return { status: 'conflict', message: COMPLETED_CLAIM_MESSAGE };
      }

      return { status: 'success', value: result.assignees };
    },

    async moveWorkItem(workItemId, moduleKey, user) {
      if (!isWorkModuleKey(moduleKey)) {
        return { status: 'invalid', message: 'İş modülü geçersiz.' };
      }

      const result = await repository.move(workItemId, moduleKey, user.id);

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'completed') {
        return { status: 'conflict', message: COMPLETED_MOVE_MESSAGE };
      }

      if (result.status === 'same-module') {
        return { status: 'invalid', message: SAME_MODULE_MESSAGE };
      }

      return { status: 'success', value: result.workItem };
    },

    async completeWorkItem(workItemId, user) {
      const result = await repository.complete(workItemId, user.id);

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      return { status: 'success', value: result.workItem };
    },

    async reopenWorkItem(workItemId, user) {
      const result = await repository.reopen(workItemId, user.id);

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      return { status: 'success', value: result.workItem };
    },

    async addComment(workItemId, body, parentCommentId, user) {
      const normalizedBody = body.trim();
      const characterCount = Array.from(normalizedBody).length;

      if (characterCount < 1 || characterCount > 2_000) {
        return {
          status: 'invalid',
          message: 'Yorum 1–2000 karakter arasında olmalıdır.',
        };
      }

      const result = await repository.addComment(
        workItemId,
        normalizedBody,
        parentCommentId ?? null,
        user,
      );

      if (result.status === 'not-found') {
        return { status: 'not-found' };
      }

      if (result.status === 'parent-not-found') {
        return {
          status: 'invalid',
          message: 'Yanıtlanacak yorum bulunamadı.',
        };
      }

      if (result.status === 'parent-work-item-mismatch') {
        return {
          status: 'invalid',
          message: 'Yalnızca aynı işe ait yorumlara yanıt verilebilir.',
        };
      }

      if (result.status === 'nested-reply') {
        return {
          status: 'invalid',
          message: 'Bir yanıta yeniden yanıt verilemez.',
        };
      }

      return { status: 'success', value: result.comment };
    },

    async addCommentReaction(workItemId, commentId, user) {
      const result = await repository.addCommentReaction(
        workItemId,
        commentId,
        user.id,
      );

      if (result.status !== 'updated') {
        return { status: 'not-found' };
      }

      return { status: 'success', value: result.reaction };
    },

    async removeCommentReaction(workItemId, commentId, user) {
      const result = await repository.removeCommentReaction(
        workItemId,
        commentId,
        user.id,
      );

      if (result.status !== 'updated') {
        return { status: 'not-found' };
      }

      return { status: 'success', value: result.reaction };
    },

    async getArchiveWorkItems(query) {
      const normalized = normalizeArchiveQuery(query);

      if (normalized.status !== 'success') {
        return normalized;
      }

      return {
        status: 'success',
        value: await repository.listArchiveWorkItems(normalized.value),
      };
    },

    async getArchiveSuggestions(query) {
      const normalizedQuery = query.trim();
      const characterCount = Array.from(normalizedQuery).length;

      if (characterCount < 2 || characterCount > 200) {
        return {
          status: 'invalid',
          message: 'Arama metni 2–200 karakter arasında olmalıdır.',
        };
      }

      return {
        status: 'success',
        value: await repository.listArchiveSuggestions(normalizedQuery),
      };
    },
  };
}
