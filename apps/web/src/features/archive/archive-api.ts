import { isWorkItemModuleKey } from '../work-items/work-item-constants'
import type {
  ArchiveCompletedBy,
  ArchiveFilters,
  ArchivePagination,
  ArchiveRequestErrorKind,
  ArchiveSuggestion,
  ArchiveSuggestionType,
  ArchiveWorkItem,
  ArchiveWorkItemsResponse,
} from './archive-types'

export class ArchiveRequestError extends Error {
  readonly kind: ArchiveRequestErrorKind

  constructor(kind: ArchiveRequestErrorKind) {
    super(kind)
    this.name = 'ArchiveRequestError'
    this.kind = kind
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0
}

function isCompletedBy(value: unknown): value is ArchiveCompletedBy {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.username)
  )
}

function isArchiveWorkItem(value: unknown): value is ArchiveWorkItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNullableString(value.orderCode) &&
    isNonEmptyString(value.companyName) &&
    isNonEmptyString(value.productName) &&
    isNullableString(value.packagingType) &&
    isNullableString(value.orderType) &&
    isNullableString(value.orderedQuantity) &&
    isWorkItemModuleKey(value.moduleKey) &&
    isNonEmptyString(value.moduleTitle) &&
    isNonEmptyString(value.completedAt) &&
    isCompletedBy(value.completedBy)
  )
}

function isPagination(value: unknown): value is ArchivePagination {
  return (
    isRecord(value) &&
    isPositiveInteger(value.page) &&
    isPositiveInteger(value.pageSize) &&
    value.pageSize <= 100 &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.totalPages)
  )
}

function isSuggestionType(value: unknown): value is ArchiveSuggestionType {
  return value === 'company' || value === 'product' || value === 'orderCode'
}

function isArchiveSuggestion(value: unknown): value is ArchiveSuggestion {
  return (
    isRecord(value) &&
    isSuggestionType(value.type) &&
    isNonEmptyString(value.value)
  )
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

    throw new ArchiveRequestError('error')
  }

  if (response.status === 401) {
    throw new ArchiveRequestError('unauthorized')
  }

  if (response.status === 400) {
    throw new ArchiveRequestError('validation')
  }

  if (response.status !== expectedStatus) {
    throw new ArchiveRequestError('error')
  }

  return response
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ArchiveRequestError('error')
  }
}

export function isArchiveRequestError(
  error: unknown,
  kind: ArchiveRequestErrorKind,
): boolean {
  return error instanceof ArchiveRequestError && error.kind === kind
}

function buildArchiveSearchParams(filters: ArchiveFilters): URLSearchParams {
  const params = new URLSearchParams()
  const query = filters.q.trim()

  if (query) {
    params.set('q', query)
  }

  if (filters.moduleKey) {
    params.set('moduleKey', filters.moduleKey)
  }

  if (filters.completedBy) {
    params.set('completedBy', filters.completedBy)
  }

  if (filters.completedFrom) {
    params.set('completedFrom', filters.completedFrom)
  }

  if (filters.completedTo) {
    params.set('completedTo', filters.completedTo)
  }

  params.set('page', String(filters.page))
  params.set('pageSize', String(filters.pageSize))

  return params
}

export async function getArchiveWorkItems(
  filters: ArchiveFilters,
  signal?: AbortSignal,
): Promise<ArchiveWorkItemsResponse> {
  const params = buildArchiveSearchParams(filters)
  const response = await request(
    `/api/archive/work-items?${params.toString()}`,
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
    !Array.isArray(payload.items) ||
    !payload.items.every(isArchiveWorkItem) ||
    !isPagination(payload.pagination)
  ) {
    throw new ArchiveRequestError('error')
  }

  return {
    items: payload.items,
    pagination: payload.pagination,
  }
}

export async function getArchiveSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<ArchiveSuggestion[]> {
  const trimmedQuery = query.trim()

  if (Array.from(trimmedQuery).length < 2) {
    return []
  }

  const params = new URLSearchParams({ q: trimmedQuery })
  const response = await request(
    `/api/archive/suggestions?${params.toString()}`,
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
    !Array.isArray(payload.suggestions) ||
    !payload.suggestions.every(isArchiveSuggestion)
  ) {
    throw new ArchiveRequestError('error')
  }

  const seen = new Set<string>()

  return payload.suggestions.filter((suggestion) => {
    const key = suggestion.value.toLocaleLowerCase('tr-TR')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  }).slice(0, 10)
}
