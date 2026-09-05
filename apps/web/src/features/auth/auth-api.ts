import type { AuthUser, LoginCredentials } from './auth-types'

export const INVALID_CREDENTIALS_MESSAGE = 'Kullanıcı adı veya şifre hatalı.'
export const SERVER_UNAVAILABLE_MESSAGE =
  'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.'

type AuthRequestErrorKind = 'invalid-credentials' | 'unavailable'

export class AuthRequestError extends Error {
  readonly kind: AuthRequestErrorKind

  constructor(kind: AuthRequestErrorKind) {
    super(kind)
    this.name = 'AuthRequestError'
    this.kind = kind
  }
}

function unavailableError(): AuthRequestError {
  return new AuthRequestError('unavailable')
}

async function request(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      credentials: 'include',
    })
  } catch {
    throw unavailableError()
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw unavailableError()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    typeof value.displayName === 'string' &&
    (value.role === 'admin' || value.role === 'member') &&
    (value.team === 'graphic' || value.team === 'digital')
  )
}

function readUser(payload: unknown): AuthUser | null {
  if (!isRecord(payload) || !('user' in payload)) {
    throw unavailableError()
  }

  if (payload.user === null) {
    return null
  }

  if (!isAuthUser(payload.user)) {
    throw unavailableError()
  }

  return payload.user
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    error instanceof AuthRequestError &&
    error.kind === 'invalid-credentials'
  ) {
    return INVALID_CREDENTIALS_MESSAGE
  }

  return SERVER_UNAVAILABLE_MESSAGE
}

export async function getSession(): Promise<AuthUser | null> {
  const response = await request('/api/auth/session', {
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status !== 200) {
    throw unavailableError()
  }

  return readUser(await readJson(response))
}

export async function login(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (response.status === 401) {
    throw new AuthRequestError('invalid-credentials')
  }

  if (response.status !== 200) {
    throw unavailableError()
  }

  const user = readUser(await readJson(response))

  if (!user) {
    throw unavailableError()
  }

  return user
}

export async function logout(): Promise<void> {
  const response = await request('/api/auth/logout', {
    method: 'POST',
  })

  if (response.status !== 204) {
    throw unavailableError()
  }
}
