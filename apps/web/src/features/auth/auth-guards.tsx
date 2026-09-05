import { Navigate, Outlet } from 'react-router'
import { useAuth } from './use-auth'

export function AuthenticatedRoute() {
  const { status } = useAuth()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function UnauthenticatedRoute() {
  const { status } = useAuth()

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
