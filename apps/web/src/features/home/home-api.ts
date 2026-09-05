import type {
  HomeAssignee,
  HomeItem,
  HomeModule,
  HomeOverview,
} from './home-types'

type HomeOverviewRequestErrorKind = 'error' | 'unauthorized'

export class HomeOverviewRequestError extends Error {
  readonly kind: HomeOverviewRequestErrorKind

  constructor(kind: HomeOverviewRequestErrorKind) {
    super(kind)
    this.name = 'HomeOverviewRequestError'
    this.kind = kind
  }
}

function requestError(): HomeOverviewRequestError {
  return new HomeOverviewRequestError('error')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value)

  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  )
}

function isHomeAssignee(value: unknown): value is HomeAssignee {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'displayName']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName)
  )
}

function isHomeItem(value: unknown): value is HomeItem {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'id',
      'title',
      'description',
      'dueDate',
      'assignees',
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isCalendarDate(value.dueDate) &&
    Array.isArray(value.assignees) &&
    value.assignees.every(isHomeAssignee)
  )
}

function isHomeModule(value: unknown): value is HomeModule {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['id', 'title', 'items']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    Array.isArray(value.items) &&
    value.items.every(isHomeItem)
  )
}

function isHomeOverview(value: unknown): value is HomeOverview {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['modules']) &&
    Array.isArray(value.modules) &&
    value.modules.every(isHomeModule)
  )
}

export function isUnauthorizedHomeOverviewError(
  error: unknown,
): boolean {
  return (
    error instanceof HomeOverviewRequestError &&
    error.kind === 'unauthorized'
  )
}

export async function getHomeOverview(
  signal?: AbortSignal,
): Promise<HomeOverview> {
  let response: Response

  try {
    response = await fetch('/api/home/overview', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
      signal,
    })
  } catch (error: unknown) {
    if (signal?.aborted) {
      throw error
    }

    throw requestError()
  }

  if (response.status === 401) {
    throw new HomeOverviewRequestError('unauthorized')
  }

  if (response.status !== 200) {
    throw requestError()
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw requestError()
  }

  if (!isHomeOverview(payload)) {
    throw requestError()
  }

  return payload
}
