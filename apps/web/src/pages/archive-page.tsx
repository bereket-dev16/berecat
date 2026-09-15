import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ArchivePageContent } from '../features/archive/archive-page-content'
import { useAuth } from '../features/auth/use-auth'
import { AppShell } from '../features/shell/components/app-shell'

export function ArchivePage() {
  const navigate = useNavigate()
  const { invalidateSession } = useAuth()

  const handleUnauthorized = useCallback(() => {
    invalidateSession()
    navigate('/login', { replace: true })
  }, [invalidateSession, navigate])

  return (
    <AppShell pageTitle="Arşiv">
      <ArchivePageContent onUnauthorized={handleUnauthorized} />
    </AppShell>
  )
}
