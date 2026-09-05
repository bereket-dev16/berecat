import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../features/auth/use-auth'
import { HomeBoard } from '../features/home/components/home-board'
import { HomeHeader } from '../features/home/components/home-header'
import { HomeLoading } from '../features/home/components/home-loading'
import { HomeSidebar } from '../features/home/components/home-sidebar'
import { useHomeOverview } from '../features/home/use-home-overview'

export function WorkspacePage() {
  const navigate = useNavigate()
  const { invalidateSession, logout, user } = useAuth()
  const { modules, retry, status } = useHomeOverview()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])

  useEffect(() => {
    if (status === 'unauthorized') {
      invalidateSession()
      navigate('/login', { replace: true })
    }
  }, [invalidateSession, navigate, status])

  if (!user) {
    return null
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    const result = await logout()

    if (result.ok) {
      navigate('/login', { replace: true })
      return
    }

    setIsLoggingOut(false)
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--page-surface)] p-2.5 text-zinc-100 sm:p-4">
      <h1 className="mb-2 px-1 text-xs font-medium tracking-wide text-zinc-400">
        Anasayfa
      </h1>

      <section className="min-h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden rounded-lg border border-white/6 bg-[var(--app-surface)] shadow-[0_14px_48px_rgba(0,0,0,0.22)]">
        <HomeHeader
          isLoggingOut={isLoggingOut}
          onOpenMenu={() => setIsSidebarOpen(true)}
          onLogout={() => void handleLogout()}
        />

        {status === 'loading' ? <HomeLoading /> : null}

        {status === 'success' ? <HomeBoard modules={modules} /> : null}

        {status === 'error' ? (
          <section className="grid min-h-[calc(100dvh-8.5rem)] place-items-center px-5 py-10">
            <div
              role="alert"
              className="w-full max-w-sm rounded-lg border border-[var(--brand-orange)]/40 bg-black/15 px-5 py-6 text-center"
            >
              <p className="text-sm font-medium text-zinc-100">
                Anasayfa verileri yüklenemedi.
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-5 min-h-11 rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#c75f1e] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
              >
                Tekrar Dene
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <HomeSidebar open={isSidebarOpen} onClose={closeSidebar} />
    </main>
  )
}
