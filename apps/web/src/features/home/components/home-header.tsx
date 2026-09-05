import { LogOut, Menu } from 'lucide-react'

interface HomeHeaderProps {
  isLoggingOut: boolean
  onLogout: () => void
  onOpenMenu: () => void
}

export function HomeHeader({
  isLoggingOut,
  onLogout,
  onOpenMenu,
}: HomeHeaderProps) {
  return (
    <header className="grid h-16 grid-cols-[minmax(2.75rem,1fr)_auto_minmax(2.75rem,1fr)] items-center border-b border-[var(--brand-orange)]/65 px-3 sm:px-4">
      <button
        id="home-menu-trigger"
        type="button"
        onClick={onOpenMenu}
        aria-label="Menüyü aç"
        className="grid size-10 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
      >
        <Menu aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>

      <img
        src="/brand/berecat-logo.png"
        alt="BereCat"
        className="size-11 select-none object-contain sm:size-12"
      />

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        aria-label="Çıkış yap"
        aria-busy={isLoggingOut}
        className="grid size-10 place-items-center justify-self-end rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
      >
        <LogOut aria-hidden="true" size={19} strokeWidth={1.8} />
      </button>
    </header>
  )
}
