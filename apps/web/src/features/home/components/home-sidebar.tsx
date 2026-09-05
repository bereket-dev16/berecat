import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface HomeSidebarProps {
  open: boolean
  onClose: () => void
}

export function HomeSidebar({ open, onClose }: HomeSidebarProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="sidebar-overlay"
          className="fixed inset-0 z-40 bg-black/70"
          onClick={onClose}
        />

        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector<HTMLButtonElement>('#home-menu-trigger')?.focus()
          }}
          className="fixed inset-y-0 left-0 z-40 flex w-[min(19rem,calc(100vw-1rem))] flex-col border-r border-[var(--brand-orange)]/55 bg-[var(--surface-raised)] px-4 py-5 shadow-2xl outline-none"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
            <Dialog.Title className="text-lg font-semibold text-white">
              BereCat
            </Dialog.Title>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Menüyü kapat"
                className="grid size-10 place-items-center rounded-md text-zinc-200 outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </Dialog.Close>
          </div>

          <nav aria-label="Ana menü" className="mt-5">
            <button
              type="button"
              onClick={onClose}
              aria-current="page"
              className="flex min-h-11 w-full items-center rounded-md border-l-2 border-[var(--brand-orange)] bg-[var(--brand-olive)]/75 px-4 text-left text-sm font-semibold text-white outline-none hover:bg-[var(--brand-olive)] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              Anasayfa
            </button>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
