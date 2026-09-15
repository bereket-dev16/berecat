import type { HomeItem } from '../home/home-types'
import { isWorkItemModuleKey } from './work-item-constants'
import type {
  CreateWorkItemInput,
  CreatedWorkItemComment,
  UserOption,
  WorkItemAssignee,
  WorkItemComment,
  WorkItemDetail,
  WorkItemEvent,
  WorkItemCommentReactionResult,
  WorkItemRequestErrorKind,
  UpdateWorkItemInput,
} from './work-item-types'

export class WorkItemRequestError extends Error {
  readonly kind: WorkItemRequestErrorKind
  readonly safeMessage: string | null

  constructor(kind: WorkItemRequestErrorKind, safeMessage: string | null = null) {
    super(kind)
    this.name = 'WorkItemRequestError'
    this.kind = kind
    this.safeMessage = safeMessage
  }
}

const safeApiMessages = new Set([
  'Tamamlanmış iş aktarılamaz. Önce işi yeniden açın.',
  'İş zaten seçilen birimde.',
  'Tamamlanmış işin ataması değiştirilemez.',
  'Tamamlanmış iş üzerinize alınamaz.',
  'Bu iş başka bir kullanıcı tarafından alınmış.',
  'Tamamlanmış iş düzenlenemez. Önce işi yeniden açın.',
  'Tamamlanmış iş silinemez. Önce işi yeniden açın.',
  'Silme onayı geçersiz.',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isUserRole(value: unknown): value is UserOption['role'] {
  return value === 'admin' || value === 'member'
}

function isUserTeam(value: unknown): value is UserOption['team'] {
  return value === 'graphic' || value === 'digital'
}

function isUserOption(value: unknown): value is UserOption {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.username) &&
    isNonEmptyString(value.displayName) &&
    isUserRole(value.role) &&
    isUserTeam(value.team)
  )
}

function isWorkItemAssignee(value: unknown): value is WorkItemAssignee {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.username) &&
    isNonEmptyString(value.displayName) &&
    isUserTeam(value.team)
  )
}

function isWorkItemCreator(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.username) &&
    isNonEmptyString(value.displayName)
  )
}

function isWorkItemCommentContent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.body) &&
    isNonEmptyString(value.createdAt) &&
    isWorkItemCreator(value.author)
  )
}

function isWorkItemReply(value: unknown): boolean {
  return (
    isWorkItemCommentContent(value) &&
    isRecord(value) &&
    Number.isInteger(value.reactionCount) &&
    typeof value.reactionCount === 'number' &&
    value.reactionCount >= 0 &&
    typeof value.reactedByCurrentUser === 'boolean'
  )
}

function isWorkItemComment(value: unknown): value is WorkItemComment {
  return (
    isWorkItemReply(value) &&
    isRecord(value) &&
    Array.isArray(value.replies) &&
    value.replies.every(isWorkItemReply)
  )
}

function isCreatedWorkItemComment(
  value: unknown,
): value is CreatedWorkItemComment {
  return (
    isWorkItemCommentContent(value) &&
    isRecord(value) &&
    (value.parentCommentId === null || isNonEmptyString(value.parentCommentId))
  )
}

function isWorkItemEvent(value: unknown): value is WorkItemEvent {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.type === 'moved' ||
      value.type === 'completed' ||
      value.type === 'reopened') &&
    isNonEmptyString(value.createdAt) &&
    isWorkItemCreator(value.actor) &&
    (value.fromModuleKey === null || isWorkItemModuleKey(value.fromModuleKey)) &&
    isNullableString(value.fromModuleTitle) &&
    (value.toModuleKey === null || isWorkItemModuleKey(value.toModuleKey)) &&
    isNullableString(value.toModuleTitle)
  )
}

function isHomeAssignee(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName)
  )
}

function isHomeItem(value: unknown): value is HomeItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.companyName) &&
    isNullableString(value.description) &&
    isNullableString(value.dueDate) &&
    (value.status === 'active' || value.status === 'completed') &&
    isNullableString(value.completedAt) &&
    Array.isArray(value.assignees) &&
    value.assignees.every(isHomeAssignee)
  )
}

function isWorkItemDetail(value: unknown): value is WorkItemDetail {
  if (!isRecord(value)) {
    return false
  }

  const nullableFields = [
    'orderCode',
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
  ] as const

  return (
    isNonEmptyString(value.id) &&
    isWorkItemModuleKey(value.moduleKey) &&
    isNonEmptyString(value.moduleTitle) &&
    isNonEmptyString(value.companyName) &&
    isNonEmptyString(value.productName) &&
    nullableFields.every((field) => isNullableString(value[field])) &&
    (value.status === 'active' || value.status === 'completed') &&
    isNullableString(value.completedAt) &&
    (value.completedBy === null || isWorkItemCreator(value.completedBy)) &&
    Array.isArray(value.assignees) &&
    value.assignees.every(isWorkItemAssignee) &&
    isWorkItemCreator(value.createdBy) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    Array.isArray(value.comments) &&
    value.comments.every(isWorkItemComment) &&
    Array.isArray(value.events) &&
    value.events.every(isWorkItemEvent)
  )
}

async function errorForResponse(response: Response): Promise<WorkItemRequestError> {
  let safeMessage: string | null = null

  try {
    const payload: unknown = await response.json()

    if (
      isRecord(payload) &&
      typeof payload.message === 'string' &&
      safeApiMessages.has(payload.message)
    ) {
      safeMessage = payload.message
    }
  } catch {
    // Hata gövdesi kullanıcıya gösterilmez.
  }

  if (response.status === 400) {
    return new WorkItemRequestError('validation', safeMessage)
  }

  if (response.status === 401) {
    return new WorkItemRequestError('unauthorized')
  }

  if (response.status === 404) {
    return new WorkItemRequestError('not-found')
  }

  if (response.status === 409) {
    return new WorkItemRequestError('conflict', safeMessage)
  }

  return new WorkItemRequestError('error')
}

async function request(
  input: string,
  init: RequestInit,
  expectedStatus: number,
): Promise<Response> {
  let response: Response

  try {
    response = await fetch(input, {
      ...init,
      credentials: 'include',
    })
  } catch (error: unknown) {
    if (init.signal?.aborted) {
      throw error
    }

    throw new WorkItemRequestError('error')
  }

  if (response.status !== expectedStatus) {
    throw await errorForResponse(response)
  }

  return response
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new WorkItemRequestError('error')
  }
}

function jsonRequest(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  }
}

export function isWorkItemRequestError(
  error: unknown,
  kind: WorkItemRequestErrorKind,
): boolean {
  return error instanceof WorkItemRequestError && error.kind === kind
}

export function getWorkItemSafeErrorMessage(error: unknown): string | null {
  return error instanceof WorkItemRequestError ? error.safeMessage : null
}

export async function getUserOptions(
  signal?: AbortSignal,
): Promise<UserOption[]> {
  const response = await request(
    '/api/users/options',
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
    200,
  )
  const payload = await readJson(response)

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.users) ||
    !payload.users.every(isUserOption)
  ) {
    throw new WorkItemRequestError('error')
  }

  return payload.users
}

export async function createWorkItem(
  input: CreateWorkItemInput,
): Promise<HomeItem> {
  const response = await request(
    '/api/work-items',
    jsonRequest(input),
    201,
  )
  const payload = await readJson(response)

  if (!isRecord(payload) || !isHomeItem(payload.workItem)) {
    throw new WorkItemRequestError('error')
  }

  return payload.workItem
}

export async function updateWorkItem(
  workItemId: string,
  input: UpdateWorkItemInput,
): Promise<HomeItem> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}`,
    {
      ...jsonRequest(input),
      method: 'PATCH',
    },
    200,
  )
  const payload = await readJson(response)

  if (!isRecord(payload) || !isHomeItem(payload.workItem)) {
    throw new WorkItemRequestError('error')
  }

  return payload.workItem
}

export async function deleteWorkItem(
  workItemId: string,
  confirmation: string,
): Promise<void> {
  await request(
    `/api/work-items/${encodeURIComponent(workItemId)}`,
    {
      ...jsonRequest({ confirmation }),
      method: 'DELETE',
    },
    204,
  )
}

export async function getWorkItemDetail(
  workItemId: string,
  signal?: AbortSignal,
): Promise<WorkItemDetail> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
    200,
  )
  const payload = await readJson(response)

  if (!isRecord(payload) || !isWorkItemDetail(payload.workItem)) {
    throw new WorkItemRequestError('error')
  }

  return payload.workItem
}

function readAssigneesPayload(payload: unknown): WorkItemAssignee[] {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.assignees) ||
    !payload.assignees.every(isWorkItemAssignee)
  ) {
    throw new WorkItemRequestError('error')
  }

  return payload.assignees
}

export async function replaceWorkItemAssignees(
  workItemId: string,
  userIds: string[],
): Promise<WorkItemAssignee[]> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/assignees`,
    {
      ...jsonRequest({ userIds }),
      method: 'PUT',
    },
    200,
  )

  return readAssigneesPayload(await readJson(response))
}

export async function claimWorkItem(
  workItemId: string,
): Promise<WorkItemAssignee[]> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/claim`,
    jsonRequest({}),
    200,
  )

  return readAssigneesPayload(await readJson(response))
}

export async function createWorkItemComment(
  workItemId: string,
  body: string,
  parentCommentId: string | null = null,
): Promise<CreatedWorkItemComment> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments`,
    jsonRequest({ body, parentCommentId }),
    201,
  )
  const payload = await readJson(response)

  if (!isRecord(payload) || !isCreatedWorkItemComment(payload.comment)) {
    throw new WorkItemRequestError('error')
  }

  return payload.comment
}

function readReactionResult(payload: unknown): WorkItemCommentReactionResult {
  if (
    !isRecord(payload) ||
    !Number.isInteger(payload.reactionCount) ||
    typeof payload.reactionCount !== 'number' ||
    payload.reactionCount < 0 ||
    typeof payload.reactedByCurrentUser !== 'boolean'
  ) {
    throw new WorkItemRequestError('error')
  }

  return {
    reactionCount: payload.reactionCount,
    reactedByCurrentUser: payload.reactedByCurrentUser,
  }
}

export async function addWorkItemCommentReaction(
  workItemId: string,
  commentId: string,
): Promise<WorkItemCommentReactionResult> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}/reaction`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json' },
    },
    200,
  )

  return readReactionResult(await readJson(response))
}

export async function removeWorkItemCommentReaction(
  workItemId: string,
  commentId: string,
): Promise<WorkItemCommentReactionResult> {
  const response = await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}/reaction`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
    200,
  )

  return readReactionResult(await readJson(response))
}

export async function moveWorkItem(
  workItemId: string,
  moduleKey: WorkItemDetail['moduleKey'],
): Promise<void> {
  await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/move`,
    jsonRequest({ moduleKey }),
    200,
  )
}

function actionRequest(): RequestInit {
  return {
    method: 'POST',
    headers: { Accept: 'application/json' },
  }
}

export async function completeWorkItem(workItemId: string): Promise<void> {
  await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/complete`,
    actionRequest(),
    200,
  )
}

export async function reopenWorkItem(workItemId: string): Promise<void> {
  await request(
    `/api/work-items/${encodeURIComponent(workItemId)}/reopen`,
    actionRequest(),
    200,
  )
}
