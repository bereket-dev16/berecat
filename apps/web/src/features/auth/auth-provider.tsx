import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getAuthErrorMessage,
  getSession,
  login as loginRequest,
  logout as logoutRequest,
} from './auth-api'
import { AuthContext } from './auth-context'
import type {
  AuthActionResult,
  AuthStatus,
  AuthUser,
  LoginCredentials,
} from './auth-types'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  sessionError: string | null
}

interface AuthProviderProps {
  children: ReactNode
}

const initialState: AuthState = {
  status: 'loading',
  user: null,
  sessionError: null,
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let isCurrent = true

    void getSession()
      .then((user) => {
        if (!isCurrent) {
          return
        }

        setState({
          status: user ? 'authenticated' : 'unauthenticated',
          user,
          sessionError: null,
        })
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return
        }

        setState({
          status: 'unauthenticated',
          user: null,
          sessionError: getAuthErrorMessage(error),
        })
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthActionResult> => {
      try {
        const user = await loginRequest(credentials)

        setState({
          status: 'authenticated',
          user,
          sessionError: null,
        })

        return { ok: true }
      } catch (error: unknown) {
        return {
          ok: false,
          message: getAuthErrorMessage(error),
        }
      }
    },
    [],
  )

  const logout = useCallback(async (): Promise<AuthActionResult> => {
    try {
      await logoutRequest()

      setState({
        status: 'unauthenticated',
        user: null,
        sessionError: null,
      })

      return { ok: true }
    } catch (error: unknown) {
      return {
        ok: false,
        message: getAuthErrorMessage(error),
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      sessionError: state.sessionError,
      login,
      logout,
    }),
    [login, logout, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
