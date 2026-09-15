import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isWorkItemRequestError, reopenWorkItem } from '../work-item-api'

interface WorkItemReopenActionProps {
  workItemId: string
  status: 'active' | 'completed'
  onChanged: () => void
  onUnauthorized: () => void
}

export function WorkItemReopenAction({
  workItemId,
  status,
  onChanged,
  onUnauthorized,
}: WorkItemReopenActionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAwaitingRefresh, setIsAwaitingRefresh] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const isBusy = isSubmitting || isAwaitingRefresh

  useEffect(() => {
    if (status !== 'active' || !isAwaitingRefresh) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsAwaitingRefresh(false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [isAwaitingRefresh, status])

  async function handleReopen() {
    if (isBusy) {
      return
    }

    setMessage(null)
    setIsSubmitting(true)

    try {
      await reopenWorkItem(workItemId)
      setIsAwaitingRefresh(true)
      onChanged()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setMessage('İş yeniden açılamadı.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleReopen()}
        disabled={isBusy}
        aria-busy={isBusy}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#12b76a] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#39cc83] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-55"
      >
        <RotateCcw aria-hidden="true" size={17} />
        {isBusy ? 'Yeniden açılıyor…' : 'İşi Yeniden Aç'}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm text-[#ffad7d]">
          {message}
        </p>
      ) : null}
    </div>
  )
}
