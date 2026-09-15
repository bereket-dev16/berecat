import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { HomeHeader } from '../../home/components/home-header'
import { HomeSidebar } from '../../home/components/home-sidebar'

interface AppShellProps {
  pageTitle: string
  children: ReactNode
}

export function AppShell({ pageTitle, children }: AppShellProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])

  if (!user) {
    return null
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setLogoutError(null)
    setIsLoggingOut(true)
    const result = await logout()

    if (result.ok) {
      navigate('/login', { replace: true })
      return
    }

    setLogoutError(result.message)
    setIsLoggingOut(false)
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--page-surface)] p-2.5 text-zinc-100 sm:p-4">
      <h1 className="mb-2 px-1 text-xs font-medium tracking-wide text-zinc-400">
        {pageTitle}
      </h1>

      <section className="min-h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden rounded-lg border border-white/6 bg-[var(--app-surface)] shadow-[0_14px_48px_rgba(0,0,0,0.22)]">
        <HomeHeader
          user={user}
          isLoggingOut={isLoggingOut}
          onOpenMenu={() => setIsSidebarOpen(true)}
          onLogout={() => void handleLogout()}
        />

        {logoutError ? (
          <div
            role="alert"
            className="border-b border-[var(--brand-orange)]/35 bg-black/20 px-4 py-2 text-center text-sm text-[#ffad7d]"
          >
            {logoutError}
          </div>
        ) : null}

        {children}
      </section>

      <HomeSidebar
        open={isSidebarOpen}
        onClose={closeSidebar}
      />
    </main>
  )
}
