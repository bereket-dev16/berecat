import * as Dialog from '@radix-ui/react-dialog'
import { Archive, House, X } from 'lucide-react'
import { NavLink } from 'react-router'

interface HomeSidebarProps {
  open: boolean
  onClose: () => void
}

export function HomeSidebar({
  open,
  onClose,
}: HomeSidebarProps) {
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
            <ul className="space-y-1.5">
              {[
                { to: '/', label: 'Anasayfa', icon: House, end: true },
                { to: '/arsiv', label: 'Arşiv', icon: Archive, end: false },
              ].map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex min-h-11 w-full items-center gap-3 rounded-md border-l-2 px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] ${
                        isActive
                          ? 'border-[var(--brand-orange)] bg-[var(--brand-olive)]/75 text-white'
                          : 'border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <item.icon aria-hidden="true" size={18} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
