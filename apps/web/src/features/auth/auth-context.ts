import { createContext } from 'react'
import type {
  AuthActionResult,
  AuthStatus,
  AuthUser,
  LoginCredentials,
} from './auth-types'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  sessionError: string | null
  login: (credentials: LoginCredentials) => Promise<AuthActionResult>
  logout: () => Promise<AuthActionResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
