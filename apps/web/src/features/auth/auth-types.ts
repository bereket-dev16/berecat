export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type UserRole = 'admin' | 'member'
export type UserTeam = 'graphic' | 'digital'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  team: UserTeam
}

export interface LoginCredentials {
  username: string
  password: string
}

export type AuthActionResult =
  | { ok: true }
  | { ok: false; message: string }
