import {
  isMasterDataKind,
  type MasterDataKind,
  type MasterDataRequestErrorKind,
  type MasterDataSuggestion,
  type MasterDataSuggestionContext,
} from './master-data-types'

export class MasterDataRequestError extends Error {
  readonly kind: MasterDataRequestErrorKind

  constructor(kind: MasterDataRequestErrorKind) {
    super(kind)
    this.name = 'MasterDataRequestError'
    this.kind = kind
  }
}

interface GetMasterDataSuggestionsInput extends MasterDataSuggestionContext {
  kind: MasterDataKind
  q?: string
  limit?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSuggestion(
  value: unknown,
  requestedKind: MasterDataKind,
): value is MasterDataSuggestion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    isMasterDataKind(value.kind) &&
    value.kind === requestedKind &&
    typeof value.value === 'string' &&
    value.value.trim().length > 0
  )
}

function truncateCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join('')
}

function appendTrimmed(
  params: URLSearchParams,
  name: string,
  value: string | undefined,
) {
  const trimmed = value?.trim()

  if (trimmed) {
    params.set(name, trimmed)
  }
}

export function isMasterDataRequestError(
  error: unknown,
  kind: MasterDataRequestErrorKind,
): boolean {
  return error instanceof MasterDataRequestError && error.kind === kind
}

export async function getMasterDataSuggestions(
  input: GetMasterDataSuggestionsInput,
  signal?: AbortSignal,
): Promise<MasterDataSuggestion[]> {
  const requestedLimit = input.limit ?? 10
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
    : 10
  const params = new URLSearchParams({
    kind: input.kind,
    limit: String(limit),
  })
  const query = truncateCodePoints(input.q?.trim() ?? '', 100)

  if (query) {
    params.set('q', query)
  }

  appendTrimmed(params, 'company', input.company)
  appendTrimmed(params, 'product', input.product)
  appendTrimmed(params, 'packagingType', input.packagingType)

  let response: Response

  try {
    response = await fetch(`/api/master-data/suggestions?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal,
    })
  } catch (error: unknown) {
    if (signal?.aborted) {
      throw error
    }

    throw new MasterDataRequestError('error')
  }

  if (response.status === 401) {
    throw new MasterDataRequestError('unauthorized')
  }

  if (response.status === 400) {
    throw new MasterDataRequestError('validation')
  }

  if (response.status !== 200) {
    throw new MasterDataRequestError('error')
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new MasterDataRequestError('error')
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.suggestions) ||
    payload.suggestions.length > 20 ||
    !payload.suggestions.every((suggestion) =>
      isSuggestion(suggestion, input.kind),
    )
  ) {
    throw new MasterDataRequestError('error')
  }

  return payload.suggestions
}
