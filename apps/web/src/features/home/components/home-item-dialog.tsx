import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { HomeItem } from '../home-types'
import { formatHomeDate } from '../format-home-date'

interface SelectedHomeItem {
  item: HomeItem
  moduleTitle: string
}

interface HomeItemDialogProps {
  open: boolean
  selected: SelectedHomeItem | null
  onOpenChange: (open: boolean) => void
  returnFocus: () => void
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')
}

export function HomeItemDialog({
  open,
  selected,
  onOpenChange,
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
            className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),46rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--brand-green)]/70 bg-[var(--dialog-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none"
          >
            <div className="flex items-start justify-between gap-5 border-b border-[var(--brand-orange)]/60 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
                  {selected.moduleTitle}
                </p>
                <Dialog.Title className="mt-1.5 text-xl font-semibold leading-7 text-white sm:text-2xl">
                  {selected.item.title}
                </Dialog.Title>
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

            <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(13rem,0.65fr)]">
              <div className="px-5 py-6 sm:px-6 md:pr-8">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-400">
                  Açıklama
                </p>
                <Dialog.Description className="mt-3 text-[0.94rem] leading-7 text-zinc-200">
                  {selected.item.description}
                </Dialog.Description>
              </div>

              <dl className="space-y-6 border-t border-white/8 px-5 py-6 sm:px-6 md:border-l md:border-t-0 md:pl-7">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-400">
                    Teslim Tarihi
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-zinc-100">
                    <time dateTime={selected.item.dueDate}>
                      {formatHomeDate(selected.item.dueDate)}
                    </time>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-400">
                    Atanan Kişiler
                  </dt>
                  <dd className="mt-3 space-y-2.5">
                    {selected.item.assignees.map((assignee) => (
                      <span
                        key={assignee.id}
                        className="flex items-center gap-2.5 text-sm text-zinc-100"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-8 place-items-center rounded-full bg-[var(--brand-orange)] text-xs font-bold text-zinc-950"
                        >
                          {getInitial(assignee.displayName)}
                        </span>
                        {assignee.displayName}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
