import { useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../features/auth/use-auth'
import { AppShell } from '../features/shell/components/app-shell'
import { WorkItemDetailContent } from '../features/work-items/components/work-item-detail-content'
import { useWorkItemDetail } from '../features/work-items/use-work-item-detail'

export function WorkItemDetailPage() {
  const { workItemId = '' } = useParams<{ workItemId: string }>()
  const navigate = useNavigate()
  const { invalidateSession } = useAuth()
  const detail = useWorkItemDetail(workItemId)

  const handleUnauthorized = useCallback(() => {
    invalidateSession()
    navigate('/login', { replace: true })
  }, [invalidateSession, navigate])

  useEffect(() => {
    if (detail.status === 'unauthorized') {
      handleUnauthorized()
    }
  }, [detail.status, handleUnauthorized])

  return (
    <AppShell pageTitle="İş Detayı">
      {detail.status === 'loading' ? (
        <section
          role="status"
          aria-label="İş detayı yükleniyor"
          className="grid min-h-[calc(100dvh-8.5rem)] place-items-center px-5 py-10"
        >
          <p className="text-sm font-medium text-zinc-300">
            İş detayı yükleniyor…
          </p>
        </section>
      ) : null}

      {detail.status === 'not-found' ? (
        <section className="grid min-h-[calc(100dvh-8.5rem)] place-items-center px-5 py-10">
          <div className="text-center">
            <p className="text-lg font-semibold text-zinc-100">
              İş bulunamadı.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              Anasayfaya Dön
            </Link>
          </div>
        </section>
      ) : null}

      {detail.status === 'error' ? (
        <section className="grid min-h-[calc(100dvh-8.5rem)] place-items-center px-5 py-10">
          <div
            role="alert"
            className="w-full max-w-sm rounded-lg border border-[var(--brand-orange)]/40 bg-black/15 px-5 py-6 text-center"
          >
            <p className="text-sm font-medium text-zinc-100">
              İş detayı yüklenemedi.
            </p>
            <button
              type="button"
              onClick={detail.reload}
              className="mt-5 min-h-11 rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              Tekrar Dene
            </button>
          </div>
        </section>
      ) : null}

      {detail.status === 'success' && detail.workItem ? (
        <WorkItemDetailContent
          workItem={detail.workItem}
          onReload={detail.reload}
          onUnauthorized={handleUnauthorized}
        />
      ) : null}
    </AppShell>
  )
}
