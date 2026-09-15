import { LogOut, Menu } from 'lucide-react'
import { Link } from 'react-router'
import type { AuthUser } from '../../auth/auth-types'

interface HomeHeaderProps {
  user: AuthUser
  isLoggingOut: boolean
  onLogout: () => void
  onOpenMenu: () => void
}

export function HomeHeader({
  user,
  isLoggingOut,
  onLogout,
  onOpenMenu,
}: HomeHeaderProps) {
  const initial = user.displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')

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

      <Link
        to="/"
        aria-label="BereCat anasayfasına git"
        className="grid size-11 place-items-center rounded-md outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] sm:size-12"
      >
        <img
          src="/brand/berecat-logo.png"
          alt=""
          className="size-full select-none object-contain"
        />
      </Link>

      <div className="flex min-w-0 items-center justify-self-end gap-1 sm:gap-2">
        <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/8 bg-black/15 p-1 pr-2 sm:gap-2 sm:pr-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-orange)] text-xs font-bold text-zinc-950"
          >
            {initial}
          </span>
          <span className="block max-w-16 truncate text-xs font-semibold text-zinc-100 sm:max-w-28">
            {user.displayName}
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          aria-label="Çıkış yap"
          aria-busy={isLoggingOut}
          className="grid size-10 shrink-0 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
        >
          <LogOut aria-hidden="true" size={19} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  )
}
