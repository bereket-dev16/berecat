import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { WorkItemActivityPanel } from '../../work-items/components/work-item-activity-panel'
import { formatWorkItemDate } from '../../work-items/format-work-item-date'
import { useWorkItemDetail } from '../../work-items/use-work-item-detail'
import type { HomeItem } from '../home-types'

interface SelectedHomeItem {
  item: HomeItem
  moduleTitle: string
}

interface HomeItemDialogProps {
  open: boolean
  selected: SelectedHomeItem | null
  onOpenChange: (open: boolean) => void
  onGoToDetail: (workItemId: string) => void
  onUnauthorized: () => void
  returnFocus: () => void
}

interface HomeItemDialogBodyProps {
  workItemId: string
  onGoToDetail: (workItemId: string) => void
  onUnauthorized: () => void
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')
}

function valueOrDash(value: string | null): string {
  return value?.trim() || '—'
}

function HomeItemDialogBody({
  workItemId,
  onGoToDetail,
  onUnauthorized,
}: HomeItemDialogBodyProps) {
  const detail = useWorkItemDetail(workItemId)

  useEffect(() => {
    if (detail.status === 'unauthorized') {
      onUnauthorized()
    }
  }, [detail.status, onUnauthorized])

  if (detail.status === 'loading') {
    return (
      <div
        role="status"
        className="grid min-h-80 place-items-center px-5 py-10 text-sm text-zinc-300"
      >
        İş detayları yükleniyor…
      </div>
    )
  }

  if (detail.status === 'error' || detail.status === 'not-found') {
    return (
      <div className="grid min-h-80 place-items-center px-5 py-10">
        <div role="alert" className="text-center">
          <p className="text-sm font-semibold text-zinc-100">
            İş detayları yüklenemedi.
          </p>
          <button
            type="button"
            onClick={detail.reload}
            className="mt-4 min-h-11 rounded-md bg-[var(--brand-orange)] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  if (detail.status !== 'success' || !detail.workItem) {
    return null
  }

  const workItem = detail.workItem

  return (
    <div className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[minmax(0,1.3fr)_minmax(24rem,0.7fr)] xl:overflow-hidden">
      <div className="overflow-y-auto px-5 py-5 sm:px-6 lg:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand-orange)]">
          {workItem.moduleTitle}
        </p>
        <p className="mt-2 text-xl font-semibold leading-7 text-white sm:text-2xl">
          {workItem.productName}
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Firma İsmi
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {workItem.companyName}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Ürün
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {workItem.productName}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Ambalaj Türü
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {valueOrDash(workItem.packagingType)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Sipariş Cinsi
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {valueOrDash(workItem.orderType)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Verilen Sipariş Miktarı
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {valueOrDash(workItem.orderedQuantity)}
            </dd>
          </div>
          {workItem.receivedQuantity ? (
            <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Gelen Sipariş Miktarı
              </dt>
              <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
                {workItem.receivedQuantity}
              </dd>
            </div>
          ) : null}
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Durum
            </dt>
            <dd className="mt-1.5 text-sm font-semibold text-zinc-100">
              {workItem.status === 'completed' ? 'Tamamlandı' : 'Devam Ediyor'}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Sipariş Gelen Tarih
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {formatWorkItemDate(workItem.orderReceivedDate)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Sipariş Verilen Tarih
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {formatWorkItemDate(workItem.orderPlacedDate)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Sipariş Termin Tarihi
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {formatWorkItemDate(workItem.orderDeadlineDate)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Sipariş Sevk Tarihi
            </dt>
            <dd className="mt-1.5 text-sm leading-6 text-zinc-100">
              {formatWorkItemDate(workItem.orderShipmentDate)}
            </dd>
          </div>
          <div className="rounded-md border border-white/8 bg-black/10 px-4 py-3 sm:col-span-2">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Ürün Detay
            </dt>
            <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100">
              {valueOrDash(workItem.productDetail)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-md border border-white/8 bg-black/10 px-4 py-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Atanan Kişiler
          </p>
          {workItem.assignees.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Atanan kişiler">
              {workItem.assignees.map((assignee) => (
                <li
                  key={assignee.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--brand-green)]/40 bg-[var(--brand-olive)]/55 py-1 pl-1 pr-3 text-sm text-zinc-100"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[var(--brand-orange)] text-[0.68rem] font-bold text-zinc-950"
                  >
                    {getInitial(assignee.displayName)}
                  </span>
                  {assignee.displayName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-300">Henüz kimse atanmadı.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onGoToDetail(workItem.id)}
          className="mt-5 min-h-11 w-full rounded-md bg-[var(--brand-orange)] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
        >
          Detaya Git
        </button>
      </div>

      <div className="border-t border-white/8 px-5 py-5 sm:px-6 xl:overflow-y-auto xl:border-l xl:border-t-0 xl:py-6">
        <WorkItemActivityPanel
          workItem={workItem}
          onReload={detail.reload}
          onUnauthorized={onUnauthorized}
          variant="panel"
        />
      </div>
    </div>
  )
}

export function HomeItemDialog({
  open,
  selected,
  onOpenChange,
  onGoToDetail,
  onUnauthorized,
  returnFocus,
}: HomeItemDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="work-item-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/75"
          onClick={() => onOpenChange(false)}
        />

        {selected ? (
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              returnFocus()
            }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[min(calc(100vw-1.5rem),84rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--brand-green)]/70 bg-[var(--dialog-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[var(--brand-orange)]/60 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
                  İş Önizlemesi
                </p>
                <Dialog.Title className="mt-1.5 truncate text-xl font-semibold leading-7 text-white sm:text-2xl">
                  {selected.item.title}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Seçilen işin güncel detayları, yorumları ve etkinlikleri.
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="İş önizlemesini kapat"
                  className="grid size-10 shrink-0 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                >
                  <X aria-hidden="true" size={21} />
                </button>
              </Dialog.Close>
            </div>

            {open ? (
              <HomeItemDialogBody
                key={selected.item.id}
                workItemId={selected.item.id}
                onGoToDetail={onGoToDetail}
                onUnauthorized={onUnauthorized}
              />
            ) : null}
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
