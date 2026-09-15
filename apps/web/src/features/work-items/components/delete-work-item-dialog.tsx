import * as Dialog from '@radix-ui/react-dialog'
import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { HomeItem } from '../../home/home-types'
import { deleteWorkItem, isWorkItemRequestError } from '../work-item-api'

interface DeleteWorkItemDialogProps {
  open: boolean
  workItem: HomeItem
  onOpenChange: (open: boolean) => void
  onDeleted: (workItemId: string) => void
  onUnauthorized: () => void
  returnFocus: () => void
}

function isValidConfirmation(value: string): boolean {
  return value.trim().toLocaleUpperCase('tr-TR') === 'SİL'
}

export function DeleteWorkItemDialog({
  open,
  workItem,
  onOpenChange,
  onDeleted,
  onUnauthorized,
  returnFocus,
}: DeleteWorkItemDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canDelete = isValidConfirmation(confirmation)

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) {
      return
    }

    if (!nextOpen) {
      setConfirmation('')
      setErrorMessage(null)
    }

    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canDelete || isSubmitting) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await deleteWorkItem(workItem.id, 'SİL')
      setConfirmation('')
      onDeleted(workItem.id)
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setErrorMessage('İş silinemedi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="delete-work-item-dialog-overlay"
          className="fixed inset-0 z-[60] bg-black/80"
          onClick={() => changeOpen(false)}
        />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus()
          }}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
          className="fixed left-1/2 top-1/2 z-[60] w-[min(calc(100vw-1.5rem),32rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--brand-orange)]/55 bg-[var(--dialog-surface)] shadow-[0_28px_90px_rgba(0,0,0,0.7)] outline-none"
        >
          <div className="flex items-start justify-between gap-5 border-b border-[var(--brand-orange)]/45 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
                Güvenli Silme
              </p>
              <Dialog.Title className="mt-1.5 text-xl font-semibold text-white">
                İşi Sil
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-300">
                Bu işlem işi panodan, arşivden ve arama sonuçlarından kaldırır.
                Yorumlar ve hareket geçmişi korunur.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="İş silme penceresini kapat"
                disabled={isSubmitting}
                className="grid size-10 shrink-0 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-50"
              >
                <X aria-hidden="true" size={21} />
              </button>
            </Dialog.Close>
          </div>

          <form className="px-5 py-5 sm:px-6" onSubmit={(event) => void handleSubmit(event)}>
            <div className="rounded-lg border border-white/9 bg-black/15 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">
                  <Trash2 aria-hidden="true" size={18} />
                </span>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-zinc-100">
                    {workItem.title}
                  </p>
                  <p className="mt-1 break-words text-sm text-zinc-400">
                    {workItem.companyName}
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-zinc-200">
                Onaylamak için SİL yazın
              </span>
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setErrorMessage(null)
                }}
                placeholder="SİL"
                autoComplete="off"
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/20 px-3 text-sm font-semibold tracking-[0.08em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25 disabled:cursor-wait disabled:opacity-60"
              />
            </label>

            <p role={errorMessage ? 'alert' : undefined} aria-live="polite" className="mt-3 min-h-5 text-sm text-[#ffad7d]">
              {errorMessage}
            </p>

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="min-h-11 rounded-md border border-white/15 px-5 text-sm font-semibold text-zinc-100 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-50"
                >
                  Vazgeç
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!canDelete || isSubmitting}
                aria-busy={isSubmitting}
                className="min-h-11 rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSubmitting ? 'Siliniyor…' : 'İşi Sil'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
