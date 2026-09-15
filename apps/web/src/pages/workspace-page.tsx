import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../features/auth/use-auth'
import { HomeBoard } from '../features/home/components/home-board'
import { HomeLoading } from '../features/home/components/home-loading'
import { useHomeOverview } from '../features/home/use-home-overview'
import { AppShell } from '../features/shell/components/app-shell'

export function WorkspacePage() {
  const navigate = useNavigate()
  const { invalidateSession } = useAuth()
  const { modules, refresh, retry, status } = useHomeOverview()

  const handleUnauthorized = useCallback(() => {
    invalidateSession()
    navigate('/login', { replace: true })
  }, [invalidateSession, navigate])

  useEffect(() => {
    if (status === 'unauthorized') {
      handleUnauthorized()
    }
  }, [handleUnauthorized, status])

  return (
    <AppShell pageTitle="Anasayfa">
      {status === 'loading' ? <HomeLoading /> : null}

      {status === 'success' ? (
        <HomeBoard
          modules={modules}
          onBoardRefresh={refresh}
          onCreated={refresh}
          onUnauthorized={handleUnauthorized}
        />
      ) : null}

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
    </AppShell>
  )
}
